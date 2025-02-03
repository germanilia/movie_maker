import logging
from src.models.models import Script
from src.services.aws_service import AWSService
import json
import asyncio
from enum import StrEnum
import random
import base64

logger = logging.getLogger(__name__)


class BedrockModels(StrEnum):
    STABLE_DIFFUSION_XL = "stability.stable-diffusion-xl-v1"
    STABLE_DIFFUSION_3 = "stability.sd3-large-v1:0"
    STABLE_DIFFUSION_3_5 = "stability.sd3-5-large-v1:0"
    STABLE_DIFFUSION_ULTRA = "stability.stable-image-ultra-v1:1"


class ImageGenerator:
    def __init__(
        self, aws_service: AWSService, model_id: BedrockModels = BedrockModels.STABLE_DIFFUSION_ULTRA, black_and_white: bool = False, genre: str = "documentary"
    ):
        """
        Initialize the ImageGenerator
        Args:
            aws_service (AWSService): AWS service instance for AWS interactions
            model_id (BedrockModels): The model ID to use for image generation
        """
        self.aws_service = aws_service
        self.model_id = model_id
        self.temp_dir = aws_service.temp_dir
        self.black_and_white = black_and_white
        self.genre = genre

    async def ensure_image_exists(
        self, image_path: str
    ) -> bool:
        """
        Check if image exists locally or in S3, download if needed.

        Args:
            image_path (str): Full S3 path to the image

        Returns:
            bool: True if image exists or was downloaded successfully, False if not found
        """
        try:
            s3_uri = f"{self.aws_service.s3_base_uri}/{image_path}"
            # Check if image exists in S3
            if await self.aws_service.file_exists(s3_uri):
                # Get local path
                local_path = self.temp_dir / image_path

                # Create local directory if it doesn't exist
                local_path.parent.mkdir(parents=True, exist_ok=True)

                # If not in temp directory, download it
                if not local_path.exists():
                    try:
                        await self.aws_service.download_file(image_path, str(local_path))
                        logger.info(f"Downloaded image {image_path} to {local_path}")
                    except Exception as e:
                        logger.error(f"Failed to download image {image_path}: {str(e)}")
                        return False
                else:
                    logger.debug(f"Image already exists locally at {local_path}")

                return True
            else:
                logger.debug(f"Image {image_path} does not exist in S3")
                return False

        except Exception as e:
            logger.error(f"Error checking image existence for {image_path}: {str(e)}")
            return False

    async def generate_images_for_script(self, script: Script) -> None:
        """Generate images for all shots in the script."""
        logger.info("Starting image generation for script")
        failed_images = []
        
        for chapter_idx, chapter in enumerate(script.chapters, 1):
            logger.info(f"Processing chapter {chapter_idx}: {chapter.chapter_title}")
            
            for scene_idx, scene in enumerate(chapter.scenes or [], 1):
                logger.info(f"Processing scene {scene_idx} in chapter {chapter_idx}")
                
                for shot_idx, shot in enumerate(scene.shots or [], 1):
                    logger.info(f"Generating images for shot {shot_idx} in scene {scene_idx}, chapter {chapter_idx}")
                    
                    # Generate opening image
                    opening_image_path = f"chapter_{chapter_idx}/scene_{scene_idx}/shot_{shot_idx}_opening.png"
                    seed = random.randint(0, 999999999)
                    try:
                        logger.info(f"Generating opening image for shot {shot_idx}")
                        await self.generate_image(
                            prompt=shot.detailed_opening_scene_description,
                            image_path=opening_image_path,
                            seed=seed,
                            overwrite_image=False
                        )
                        logger.info(f"Successfully generated opening image: {opening_image_path}")
                    except Exception as e:
                        logger.error(f"Failed to generate opening image for shot {shot_idx}: {str(e)}")
                        failed_images.append((opening_image_path, str(e)))
                        continue
                    
                    # Generate closing image
                    closing_image_path = f"chapter_{chapter_idx}/scene_{scene_idx}/shot_{shot_idx}_closing.png"
                    try:
                        logger.info(f"Generating closing image for shot {shot_idx}")
                        await self.generate_image(
                            prompt=shot.detailed_closing_scene_description,
                            image_path=closing_image_path,
                            seed=seed,
                            overwrite_image=False
                        )
                        logger.info(f"Successfully generated closing image: {closing_image_path}")
                    except Exception as e:
                        logger.error(f"Failed to generate closing image for shot {shot_idx}: {str(e)}")
                        failed_images.append((closing_image_path, str(e)))
                        continue
                    
                    # Add delay to avoid rate limiting
                    await asyncio.sleep(1)
                
                logger.info(f"Completed image generation for scene {scene_idx} in chapter {chapter_idx}")
            
            logger.info(f"Completed image generation for chapter {chapter_idx}")
        
        if failed_images:
            logger.warning(f"Image generation completed with {len(failed_images)} failures:")
            for path, error in failed_images:
                logger.warning(f"- Failed to generate {path}: {error}")
        else:
            logger.info("Completed image generation for entire script successfully")

    async def generate_image(self, prompt: str, image_path: str, seed: int | None = None, overwrite_image: bool = False) -> None:
        """
        Generate a single image based on the prompt and save it to the specified path.
        If generation fails, uses a stock image instead.
        Args:
            prompt (str): The text prompt for image generation
            image_path (str): Full S3 path to save the generated image
            seed (int | None, optional): Seed for reproducible image generation. If None, a random seed will be used.
        """
        # Check if image already exists locally or in S3
        image_exists = await self.ensure_image_exists(image_path)
        if image_exists and not overwrite_image:
            logger.info(f"Image already exists for {image_path}, skipping generation")
            return

        try:
            # If no seed is provided, generate a random one
            if seed is None:
                seed = random.randint(0, 999999999)

            if self.black_and_white:
                prompt = f'black and white, {prompt}'
            prompt = f"The image should be very high quality, styled as a {self.genre} image, {prompt}"
            
            prompt = prompt.replace("Nazi", "German Soldier")
            
            request_payload = {
                "prompt": f'{prompt}',
                "mode": "text-to-image",
                "aspect_ratio": "1:1",
                "output_format": "jpeg",
                "seed": seed
            }

            # Convert the payload to JSON bytes
            body_bytes = json.dumps(request_payload).encode("utf-8")

            # Invoke Bedrock for image generation
            response = self.aws_service.bedrock_runtime.invoke_model(
                modelId=self.model_id, 
                body=body_bytes
            )
            response_data = json.loads(response["body"].read())
            
            # Extract base64 image from response
            if "artifacts" in response_data and len(response_data["artifacts"]) > 0:
                base64_image_data = response_data["artifacts"][0]["base64"]
                await self.aws_service.upload_base64_file(
                    base64_image_data, 
                    image_path
                )
            elif "images" in response_data and len(response_data["images"]) > 0:
                base64_image_data = response_data["images"][0]
                await self.aws_service.upload_base64_file(
                    base64_image_data, 
                    image_path
                )
            else:
                logger.error("No image data in response, using stock image")
                stock_image_path = "stock_images/failed_generation.png"
                with open(stock_image_path, "rb") as image_file:
                    stock_image_data = base64.b64encode(image_file.read()).decode('utf-8')
                await self.aws_service.upload_base64_file(
                    stock_image_data,
                    image_path
                )
                logger.info(f"Used stock image for failed generation at {image_path}")
                return

            logger.info(f"Generated and saved image to {image_path} with seed {seed}")

        except Exception as e:
            logger.error(f"Failed to generate image for {image_path}: {str(e)}")
            # Use stock image instead
            stock_image_path = "stock_images/failed_generation.png"
            with open(stock_image_path, "rb") as image_file:
                stock_image_data = base64.b64encode(image_file.read()).decode('utf-8')
            await self.aws_service.upload_base64_file(
                stock_image_data,
                image_path
            )
            logger.info(f"Used stock image for failed generation at {image_path}")
