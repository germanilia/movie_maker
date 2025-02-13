import os
import logging
from huggingface_hub import InferenceClient
from src.services.aws_service import AWSService
from src.models.models import Script

logger = logging.getLogger(__name__)

class ImageGenerator:
    def __init__(
        self, 
        aws_service: AWSService,
        black_and_white: bool = False,
        genre: str = "documentary"
    ):
        self.api_token = os.getenv("HUGGING_FACE_TOKEN")
        self.aws_service = aws_service
        self.black_and_white = black_and_white
        self.genre = genre
        self.client = InferenceClient(
            provider="hf-inference",
            api_key=self.api_token
        )
        self.model = "black-forest-labs/FLUX.1-dev"

    async def generate_image(
        self, 
        prompt: str, 
        image_path: str, 
        seed: int | None = None,
        overwrite_image: bool = False
    ) -> None:
        """Generate a single image and save to AWS S3"""
        try:
            # Check if image exists and skip if not overwriting
            if not overwrite_image and await self.aws_service.file_exists(f"images/{image_path}"):
                logger.info(f"Image already exists at {image_path}, skipping generation")
                return

            # Enhance prompt based on settings
            if self.black_and_white:
                prompt = f'black and white, {prompt}'
            prompt = f"The image should be very high quality, styled as a {self.genre} image, {prompt}"

            # Generate image using FLUX.1 model
            image = self.client.text_to_image(
                prompt,
                model=self.model
            )
            
            # Save locally first
            local_path = self.aws_service.temp_dir / image_path
            local_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(str(local_path))
            
            # Upload to S3
            await self.aws_service.upload_file(
                str(local_path),
                f"images/{image_path}"
            )
            
            logger.info(f"Generated and uploaded image to {image_path}")

        except Exception as e:
            logger.error(f"Failed to generate image: {str(e)}")
            raise

    async def generate_images_for_script(self, script: Script) -> None:
        """Generate images for all shots in the script"""
        logger.info("Starting image generation for script")
        
        for chapter_idx, chapter in enumerate(script.chapters, 1):
            for scene_idx, scene in enumerate(chapter.scenes or [], 1):
                for shot_idx, shot in enumerate(scene.shots or [], 1):
                    try:
                        # Generate opening image
                        if shot.detailed_opening_scene_description:
                            opening_image_path = f"chapter_{chapter_idx}/scene_{scene_idx}/shot_{shot_idx}_opening.png"
                            await self.generate_image(
                                prompt=shot.detailed_opening_scene_description,
                                image_path=opening_image_path,
                                overwrite_image=False
                            )

                        # Generate closing image
                        if shot.detailed_closing_scene_description:
                            closing_image_path = f"chapter_{chapter_idx}/scene_{scene_idx}/shot_{shot_idx}_closing.png"
                            await self.generate_image(
                                prompt=shot.detailed_closing_scene_description,
                                image_path=closing_image_path,
                                overwrite_image=False
                            )
                    except Exception as e:
                        logger.error(f"Failed to generate image for shot: {str(e)}")
                        continue
