import logging
from src.models.models import Script
from src.services.aws_service import AWSService
from src.services.image_service import ImageService
import asyncio
import base64
from typing import List, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

class ImageGenerator:
    def __init__(
        self, 
        aws_service: AWSService, 
        black_and_white: bool = False, 
        genre: str = "documentary"
    ):
        """
        Initialize the ImageGenerator
        Args:
            aws_service (AWSService): AWS service instance for AWS interactions
            black_and_white (bool): Whether to generate black and white images
            genre (str): The genre style to apply to images
        """
        self.aws_service = aws_service
        self.image_service = ImageService(aws_service, black_and_white, genre)
        self.temp_dir = Path(aws_service.temp_dir)

    async def ensure_image_exists(self, image_path: str) -> bool:
        """Check if image exists in the temp directory"""
        full_path = self.temp_dir / image_path
        return full_path.exists()

    def _encode_image_to_base64(self, image_path: Path) -> str:
        """Convert image to base64 with data URL prefix"""
        try:
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode("utf-8")
                return f"data:image/png;base64,{base64_image}"
        except Exception as e:
            logger.error(f"Failed to encode image to base64: {str(e)}")
            return self.get_fallback_image()

    def get_fallback_image(self) -> str:
        """Get fallback image as base64 with data URL prefix"""
        try:
            stock_image_path = Path("stock_images/failed_generation.png")
            return self._encode_image_to_base64(stock_image_path)
        except Exception as e:
            logger.error(f"Failed to get fallback image: {str(e)}")
            return ""

    async def generate_image(
        self, 
        prompt: str, 
        image_path: str, 
        seed: int | None = None, 
        overwrite_image: bool = False
    ) -> str:
        """Generate image and return as base64 data URL"""
        success, path = await self.image_service.generate_image(
            prompt=prompt,
            image_path=image_path,
            seed=seed,
            overwrite_image=overwrite_image
        )
        
        if success and path:
            return self._encode_image_to_base64(Path(path))
        return self.get_fallback_image()

    async def _generate_single_image(
        self, 
        prompt: str, 
        image_path: str, 
        failed_images: List[Tuple[str, str]]
    ) -> bool:
        """
        Generate a single image and handle failures.
        Args:
            prompt: The image generation prompt
            image_path: Path where the image should be saved
            failed_images: List to track failed generations
        Returns:
            bool: True if generation was successful
        """
        try:
            base64_image = await self.generate_image(
                prompt=prompt,
                image_path=image_path,
                overwrite_image=False
            )
            return bool(base64_image and not base64_image.endswith(self.get_fallback_image()))
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to generate image {image_path}: {error_msg}")
            failed_images.append((image_path, error_msg))
            return False

    async def generate_images_for_script(self, script: Script) -> List[Tuple[str, str]]:
        """
        Generate images for all shots in the script.
        Returns:
            List[Tuple[str, str]]: List of failed image paths and their error messages
        """
        logger.info("Starting image generation for script")
        failed_images = []
        
        for chapter_idx, chapter in enumerate(script.chapters, 1):
            logger.info(f"Processing chapter {chapter_idx}: {chapter.chapter_title}")
            
            for scene_idx, scene in enumerate(chapter.scenes or [], 1):
                logger.info(f"Processing scene {scene_idx} in chapter {chapter_idx}")
                
                for shot_idx, shot in enumerate(scene.shots or [], 1):
                    logger.info(f"Processing shot {shot_idx} in scene {scene_idx}, chapter {chapter_idx}")
                    
                    # Process opening scene
                    if shot.detailed_opening_scene_description:
                        image_path = f"chapter_{chapter_idx}/scene_{scene_idx}/shot_{shot_idx}_opening.png"
                        success = await self._generate_single_image(
                            shot.detailed_opening_scene_description,
                            image_path,
                            failed_images
                        )
                        if not success:
                            logger.warning(f"Failed to generate opening image for shot {shot_idx}")
                    
                    # Process closing scene
                    if shot.detailed_closing_scene_description:
                        image_path = f"chapter_{chapter_idx}/scene_{scene_idx}/shot_{shot_idx}_closing.png"
                        success = await self._generate_single_image(
                            shot.detailed_closing_scene_description,
                            image_path,
                            failed_images
                        )
                        if not success:
                            logger.warning(f"Failed to generate closing image for shot {shot_idx}")
                    
                    # Add delay to avoid rate limiting
                    await asyncio.sleep(1)
        
        if failed_images:
            logger.warning(f"Image generation completed with {len(failed_images)} failures")
        else:
            logger.info("Completed image generation for entire script successfully")
        
        return failed_images
