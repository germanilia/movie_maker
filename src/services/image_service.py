import os
import logging
import requests
from midjourney_sdk_py import Midjourney
from src.services.aws_service import AWSService
from src.models.models import Script
from pathlib import Path
import base64
from typing import Tuple
from datetime import datetime
import uuid
from PIL import Image
import re

logger = logging.getLogger(__name__)

class ImageService:
    def __init__(
        self,
        aws_service: AWSService,
        black_and_white: bool = False,
        genre: str = "documentary",
    ):
        self.discord_channel_id = os.getenv("DISCORD_CHANNEL_ID")
        self.session_id = os.getenv("DISCORD_SESSION_ID")
        self.discord_token = os.getenv("DISCORD_TOKEN")
        if not self.discord_channel_id or not self.discord_token:
            raise ValueError("Missing required Discord credentials in environment variables")

        self.aws_service = aws_service
        self.black_and_white = black_and_white
        self.genre = genre
        self.client = Midjourney(
            self.discord_channel_id,
            self.discord_token,
            self.session_id,
        )
        self.temp_dir = Path(aws_service.temp_dir)

    def get_local_path(self, image_path: str) -> Path:
        """Get the local path for an image"""
        return self.temp_dir / image_path

    def get_download_path(self, image_path: str) -> Path:
        """Get the download path for images"""
        downloads_folder = Path(self.temp_dir / image_path).parent
        downloads_folder.mkdir(parents=True, exist_ok=True)
        return downloads_folder

    def _encode_image_to_base64(self, image_path: Path) -> str:
        """Convert image to base64 with data URL prefix"""
        try:
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode("utf-8")
                return f"data:image/png;base64,{base64_image}"
        except Exception as e:
            logger.error(f"Failed to encode image to base64: {str(e)}")
            return None

    def get_fallback_image(self) -> str:
        """Get fallback image as base64 with data URL prefix"""
        try:
            stock_image_path = Path("stock_images/failed_generation.png")
            return self._encode_image_to_base64(stock_image_path)
        except Exception as e:
            logger.error(f"Failed to get fallback image: {str(e)}")
            return None

    async def generate_image(
        self,
        prompt: str,
        image_path: str,
        seed: int | None = None,
        overwrite_image: bool = False,
    ) -> Tuple[bool, str | None]:
        """Generate image using Midjourney and save locally"""
        try:
            local_path = self.get_local_path(image_path)
            
            # Check if image exists locally and skip if not overwriting
            if not overwrite_image and local_path.exists():
                logger.info(f"Image already exists at {image_path}, skipping generation")
                return True, str(local_path)

            # Enhance prompt based on settings
            if self.black_and_white:
                prompt = f"black and white, {prompt}"
            prompt = f"The image should be very high quality, styled as a {self.genre} image, {prompt}"

            # Generate image using Midjourney
            options = {
                "ar": "16:9",
                "v": "6.1",
            }

            message = self.client.generate(prompt, options)

            if not message or "upscaled_photo_url" not in message:
                raise Exception("Failed to generate image with Midjourney")

            # Download and process the image
            save_path = self.get_download_path(image_path)
            downloaded_path = self.download_and_convert_image(
                image_url=message["upscaled_photo_url"],
                image_name=Path(image_path).stem,
                save_path=save_path,
                compression=0.95,
                size=None,  # Keep original size
                crop=False,
            )

            if not downloaded_path:
                raise Exception("Failed to download image from Midjourney")

            logger.info(f"Generated and saved image to {downloaded_path}")
            return True, str(downloaded_path)

        except Exception as e:
            logger.error(f"Failed to generate image: {str(e)}")
            return False, None

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
                                overwrite_image=False,
                            )

                        # Generate closing image
                        if shot.detailed_closing_scene_description:
                            closing_image_path = f"chapter_{chapter_idx}/scene_{scene_idx}/shot_{shot_idx}_closing.png"
                            await self.generate_image(
                                prompt=shot.detailed_closing_scene_description,
                                image_path=closing_image_path,
                                overwrite_image=False,
                            )
                    except Exception as e:
                        logger.error(f"Failed to generate image for shot: {str(e)}")
                        continue

    def clean_filename(self, filename: str) -> str:
        """Clean filename by removing invalid characters"""
        cleaned = re.sub(r'[^\w\s-]', '', filename)
        cleaned = re.sub(r'[-\s]+', '_', cleaned)
        return cleaned.strip('_')

    def download_and_convert_image(
        self,
        image_url: str,
        image_name: str = None,
        save_path: Path = None,
        compression: float = 0.9,
        size: tuple = None,
        crop: bool = False
    ) -> str | None:
        """Download and process an image, returning the path to the saved file"""
        try:
            response = requests.get(image_url)
            response.raise_for_status()

            if image_name is None:
                image_name = f"{uuid.uuid4()}-{datetime.now().strftime('%d-%m-%Y')}"
            
            image_name = self.clean_filename(image_name)
            save_path = save_path or self.temp_dir
            
            # Save as PNG directly
            png_path = save_path / f"{image_name}.png"
            
            with open(png_path, 'wb') as f:
                f.write(response.content)

            # Process the image if needed
            if size is not None or compression < 1.0:
                with Image.open(png_path) as img:
                    if size is not None:
                        if crop:
                            target_ratio = size[0] / size[1]
                            if img.width / img.height > target_ratio:
                                new_width = int(img.height * target_ratio)
                                offset = (img.width - new_width) // 2
                                img = img.crop((offset, 0, offset + new_width, img.height))
                            else:
                                new_height = int(img.width / target_ratio)
                                offset = (img.height - new_height) // 2
                                img = img.crop((0, offset, img.width, offset + new_height))
                        img = img.resize(size, Image.LANCZOS)
                    
                    if compression < 1.0:
                        img.save(png_path, "PNG", optimize=True)

            return str(png_path)
        except Exception as e:
            logger.error(f"Error during image processing: {str(e)}")
            return None
