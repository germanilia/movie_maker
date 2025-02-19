import logging
import base64
import cv2
import numpy as np
import os
from typing import Dict, List
from insightface.app import FaceAnalysis
import insightface
import tempfile
import shutil

from src.services.aws_service import AWSService
from src.services.image_service import ImageService

logger = logging.getLogger(__name__)


class FaceDetectionService:
    def __init__(self, aws_service: AWSService, image_service: ImageService):
        self.models_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "face_swapping_models",
        )
        self.image_service = image_service
        self.aws_service = aws_service
        # Initialize face detection and swapping models
        self.app = FaceAnalysis(name="buffalo_l")
        self.app.prepare(ctx_id=-1, det_size=(640, 640))  # Use -1 for CPU
        self.swapper = insightface.model_zoo.get_model(
            os.path.join(self.models_path, "inswapper_128.onnx")
        )

    def _load_image(self, image_path: str) -> np.ndarray:
        """Internal method to load an image"""
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Unable to load image from {image_path}")
        return img

    def _detect_faces(self, image: np.ndarray) -> Dict[int, dict]:
        """Internal method to detect faces in an image"""
        faces = self.app.get(image)
        return {i: face for i, face in enumerate(faces)}

    async def detect_faces_multiple(self, image_paths: List[str]) -> Dict:
        """Detect faces in multiple images"""
        try:
            # We'll just use the first image since we're currently only processing one image at a time
            if not image_paths:
                raise ValueError("No image paths provided")
                
            image = self._load_image(image_paths[0])
            faces = self._detect_faces(image)

            faces_data = {}
            for idx, face in faces.items():
                bbox = face.bbox.astype(int)
                faces_data[str(idx)] = {
                    "bbox": bbox.tolist(),
                    "kps": face.kps.tolist() if hasattr(face, "kps") else None,
                    "det_score": float(face.det_score) if hasattr(face, "det_score") else None,
                }

            return faces_data

        except Exception as e:
            logger.error(f"Error in face detection: {str(e)}")
            raise

    async def swap_faces(self, source_image_path: str, target_image_path: str) -> str:
        """Swap faces between two images"""
        try:
            source_img = self._load_image(source_image_path)
            target_img = self._load_image(target_image_path)

            source_faces = self._detect_faces(source_img)
            target_faces = self._detect_faces(target_img)

            if not source_faces or not target_faces:
                raise Exception("No faces detected in one or both images")

            # Get first detected faces
            source_face = next(iter(source_faces.values()))
            target_face = next(iter(target_faces.values()))

            # Perform face swap
            result_img = self.swapper.get(
                target_img,
                target_face,
                source_face,
                paste_back=True
            )

            # Convert result to base64
            _, buffer = cv2.imencode(".png", result_img)
            img_base64 = base64.b64encode(buffer).decode("utf-8")
            await self.image_service.upscale_image(b64_image=img_base64)
            return img_base64

        except Exception as e:
            logger.error(f"Error in face swapping: {str(e)}")
            raise

    async def swap_faces_custom(
        self,
        target_image_path: str,
        source_images: List[Dict[str, str]],
        swap_instructions: List[Dict],
    ) -> str:
        temp_dir = None
        backup_path = None
        
        try:
            # Create a temporary directory
            temp_dir = tempfile.mkdtemp()
            
            # Create backup of target image
            backup_path = target_image_path + ".backup"
            shutil.copy2(target_image_path, backup_path)
            
            # Load and process target image
            target_img = self._load_image(target_image_path)
            target_faces = self.app.get(target_img)
            
            if not target_faces:
                raise ValueError("No faces detected in target image")
            
            logger.info(f"Detected {len(target_faces)} faces in target image")
            
            # Process source images
            processed_sources = {}
            for source in source_images:
                source_img = self._load_image(source["path"])
                faces = self.app.get(source_img)
                if not faces:
                    logger.warning(f"No faces detected in source image {source['name']}")
                    continue
                processed_sources[source["name"]] = {
                    "image": source_img,
                    "faces": faces
                }
                logger.info(f"Detected {len(faces)} faces in source image {source['name']}")

            # Initialize result image with target
            result_img = target_img.copy()
            
            # Process each swap instruction
            for idx, instr in enumerate(swap_instructions):
                target_idx = instr["target_idx"] if isinstance(instr, dict) else instr.target_idx
                source_idx = instr["source_idx"] if isinstance(instr, dict) else instr.source_idx
                
                # if source_name not in processed_sources:
                #     logger.warning(f"Source image {source_name} not found")
                #     continue
                
                source_data = processed_sources[f'source_{source_idx}.png']
                # if source_idx >= len(source_data["faces"]):
                #     logger.warning(f"Source face index {source_idx} out of range")
                #     continue
                    
                # if target_idx >= len(target_faces):
                #     logger.warning(f"Target face index {target_idx} out of range")
                #     continue
                
                # Get source and target faces
                source_face = source_data["faces"][0]
                target_face = target_faces[target_idx]
                
                try:
                    # Perform face swap
                    temp_result = self.swapper.get(
                        result_img,
                        target_face,
                        source_face,
                        paste_back=True
                    )
                    
                    # Save and verify intermediate result
                    temp_path = os.path.join(temp_dir, f"swap_{idx}.png")
                    cv2.imwrite(temp_path, temp_result)
                    
                    # Verify the swap was successful
                    verification = cv2.imread(temp_path)
                    if verification is None or verification.size == 0:
                        logger.error(f"Failed to verify swap for face {target_idx}")
                        continue
                    
                    # Compare with previous result
                    if np.array_equal(verification, result_img):
                        logger.warning(f"No change detected in swap {idx}")
                        continue
                        
                    # Update result image if verification passed
                    result_img = verification.copy()
                    logger.info(f"Successfully swapped face {target_idx} with {source_idx}[{source_idx}]")
                    
                except Exception as e:
                    logger.error(f"Error during face swap operation {idx}: {str(e)}")
                    continue

            # Verify final result differs from original
            if np.array_equal(result_img, target_img):
                raise ValueError("No changes detected in final result")

            # Save final result
            cv2.imwrite(target_image_path, result_img)
            
            # Encode final result
            _, buffer = cv2.imencode(".png", result_img)
            img_base64 = base64.b64encode(buffer).decode("utf-8")
            
            return img_base64

        except Exception as e:
            logger.error(f"Error in custom face swapping: {str(e)}")
            # Restore backup on error
            if backup_path and os.path.exists(backup_path):
                shutil.copy2(backup_path, target_image_path)
            raise

        finally:
            # Cleanup
            try:
                if temp_dir and os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
                if backup_path and os.path.exists(backup_path):
                    os.remove(backup_path)
            except Exception as cleanup_error:
                logger.error(f"Error cleaning up: {str(cleanup_error)}")
