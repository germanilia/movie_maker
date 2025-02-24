import asyncio
import os
import logging
import base64
from pathlib import Path
import time
from typing import Tuple
import aiohttp
from PIL import Image
import io
from runwayml import RunwayML
from src.services.aws_service import AWSService
from src.services.video_service_base import BaseVideoService, VideoModel

logger = logging.getLogger(__name__)


class RunwayMLVideoService(BaseVideoService):
    def __init__(self, aws_service: AWSService):
        super().__init__(aws_service)
        logger.info("Initializing RunwayMLVideoService")
        self.runway_token = os.getenv("RUNWAYML_API_KEY")
        if not self.runway_token:
            logger.error("Missing RunwayML API token. Required: RUNWAYML_API_KEY")
            raise ValueError(
                "Missing required RunwayML API token in environment variables"
            )

        self.client = RunwayML(api_key=self.runway_token)
        self.video_model = VideoModel(model_name="gen3a_turbo", parameters={})
    def _resize_and_encode_image(self, image_path: str, max_size: tuple = (1024, 1024)) -> str:
        """Resize image and encode to base64 with size optimization"""
        with Image.open(image_path) as img:
            # Convert to RGB if image is in RGBA mode
            if img.mode == 'RGBA':
                img = img.convert('RGB')
            
            # Resize image while maintaining aspect ratio
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Save to bytes buffer with optimization
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=85, optimize=True)
            buffer.seek(0)
            
            # Convert to base64
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    async def generate_video(
        self,
        chapter: str,
        scene: str,
        shot: str,
        overwrite: bool = False,
        poll_interval: int = 10,
        prompt: str = "",
    ) -> Tuple[bool, str | None]:
        """Generate video for a specific shot using RunwayML"""
        video_path = self.get_shot_path(chapter, scene, shot)
        start_time = time.time()
        logger.info(f"Starting video generation for shot {chapter}/{scene}/{shot}")

        try:
            # local_path = self.get_local_path(video_path)

            # if not overwrite and local_path.exists():
            #     logger.info(
            #         f"Video file already exists at {video_path}, skipping generation"
            #     )
            #     return True, str(local_path)

            # Prepare both opening and closing frames
            frames = [("opening", "first")]
            prompt_images = []

            for frame_type, position in frames:
                frame_path = self.get_shot_image_path(chapter, scene, shot, frame_type)
                if frame_path.exists():
                    prompt_images.append(
                        {
                            "position": position,
                            "uri": self._resize_and_encode_image(str(frame_path)),
                        }
                    )
                else:
                    logger.error(
                        f"{frame_type.capitalize()} frame not found at {frame_path}"
                    )
                    return False, None

            logger.info("Calling RunwayML API for video generation")

            images = f"data:image/jpeg;base64,{prompt_images[0]['uri']}"
            image_to_video = self.client.image_to_video.create(
                model="gen3a_turbo",  # Using the correct literal type
                prompt_image=images,
                prompt_text=prompt,
                seed=1,
                **dict(self.video_model.parameters or {}),
            )

            if not image_to_video:
                logger.error("RunwayML API failed to return valid response")
                raise Exception("Failed to generate video with RunwayML")

            task_id = image_to_video.id
            logger.info(f"Video generation task created with ID: {task_id}")

            # Poll until task completion
            while True:
                task = self.client.tasks.retrieve(task_id)
                if task.status == "SUCCEEDED":
                    break
                elif task.status == "FAILED":
                    raise Exception(f"Video generation task failed: {task}")

                logger.debug(
                    f"Task status: {task.status}, waiting {poll_interval} seconds..."
                )
                await asyncio.sleep(poll_interval)

            # Download the completed video
            save_path = self.get_download_path(video_path)
            downloaded_path = save_path / f"{Path(video_path).stem}.mp4"

            # Download video from task output URL
            if not task or not task.output:
                raise Exception("No task output found")
            video_url = task.output[0]
            if not video_url:
                raise Exception("No video URL found in task output")
            async with aiohttp.ClientSession() as session:
                async with session.get(video_url) as response:
                    response.raise_for_status()
                    with open(downloaded_path, "wb") as f:
                        async for chunk in response.content.iter_chunked(8192):
                            f.write(chunk)

            generation_time = time.time() - start_time
            logger.info(
                f"Successfully generated and saved video to {downloaded_path} in {generation_time:.2f} seconds"
            )
            return True, str(downloaded_path)

        except Exception as e:
            logger.error(
                f"Video generation failed after {time.time() - start_time:.2f} seconds: {str(e)}"
            )
            return False, None
