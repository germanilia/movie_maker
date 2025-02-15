import asyncio
import os
import logging
import base64
from pathlib import Path
import time
from typing import Any, Tuple, Optional, Union, List
import aiohttp
from pydantic import BaseModel

from runwayml import RunwayML
from src.services.aws_service import AWSService

logger = logging.getLogger(__name__)

class VideoModel(BaseModel):
    model_name: str
    parameters: Any | None = None

class VideoService:
    def __init__(self, aws_service: AWSService):
        logger.info("Initializing VideoService")
        self.runway_token = os.getenv("RUNWAYML_API_KEY")
        if not self.runway_token:
            logger.error("Missing RunwayML API token. Required: RUNWAYML_API_KEY")
            raise ValueError("Missing required RunwayML API token in environment variables")

        self.client = RunwayML(api_key=self.runway_token)
        self.temp_dir = Path(aws_service.temp_dir)
        logger.info(f"VideoService initialized. Using temp directory: {self.temp_dir}")

        self.video_model = VideoModel(
            model_name="gen3a_turbo",
            parameters={}
        )

    def get_local_path(self, video_path: str) -> Path:
        """Get the local path for a video file"""
        path = self.temp_dir / video_path
        logger.debug(f"Resolved local path: {path}")
        return path

    def get_shot_path(self, chapter: str, scene: str, shot: str) -> str:
        """Construct the path for a specific shot"""
        return f"chapter_{chapter}/scene_{scene}/shot_{shot}_video.mp4"

    def get_download_path(self, video_path: str) -> Path:
        """Get the download path for video files"""
        downloads_folder = Path(self.temp_dir / video_path).parent
        downloads_folder.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created download directory: {downloads_folder}")
        return downloads_folder

    def video_exists(self, chapter: str, scene: str, shot: str) -> bool:
        """Check if a video exists for the given shot"""
        video_path = self.get_shot_path(chapter, scene, shot)
        return self.get_local_path(video_path).exists()

    def _encode_image_to_base64(self, image_path: str) -> str:
        """Convert image to base64 string with data URI prefix"""
        try:
            with open(image_path, 'rb') as image_file:
                # Get file extension from path
                extension = Path(image_path).suffix.lower().replace('.', '')
                # Convert extension if needed
                if extension == 'jpg':
                    extension = 'jpeg'
                # Read and encode file
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                # Return with required data URI prefix
                return f"data:image/{extension};base64,{encoded_string}"
        except Exception as e:
            logger.error(f"Failed to encode image to base64: {str(e)}")
            raise

    def get_shot_image_path(self, chapter: str, scene: str, shot: str, type_str: str) -> Path:
        """Get the path for a shot's image file (opening or closing)"""
        return self.temp_dir / f"chapter_{chapter}/scene_{scene}/shot_{shot}_{type_str}.png"  # Changed to .png extension

    def _prepare_images(self, chapter: str, scene: str, shot: str, images: Union[str, List[str]], type_str: str) -> Union[str, List[str]]:
        """Prepare images for API request - convert local paths to base64"""
        try:
            if isinstance(images, list):
                prepared_images = []
                for idx, img in enumerate(images):
                    image_path = self.get_shot_image_path(chapter, scene, shot, f"{type_str}_{idx}")
                    if image_path.exists():
                        prepared_images.append(self._encode_image_to_base64(str(image_path)))
                    else:
                        prepared_images.append(img)  # Use as is if not a local path
                return prepared_images
            else:
                image_path = self.get_shot_image_path(chapter, scene, shot, type_str)
                if image_path.exists():
                    return self._encode_image_to_base64(str(image_path))
                return images  # Use as is if not a local path
        except Exception as e:
            logger.error(f"Failed to prepare images: {str(e)}")
            raise

    async def generate_video(
        self,
        prompt: str,
        chapter: str,
        scene: str,
        shot: str,
        overwrite: bool = False,
        poll_interval: int = 10
    ) -> Tuple[bool, str | None]:
        """Generate video for a specific shot using RunwayML
        
        Args:
            prompt: Text prompt describing the desired video
            chapter: Chapter number/id
            scene: Scene number/id
            shot: Shot number/id
            overwrite: Whether to overwrite existing video
            poll_interval: Seconds to wait between polling for task completion
        """
        video_path = self.get_shot_path(chapter, scene, shot)
        start_time = time.time()
        logger.info(f"Starting video generation for shot {chapter}/{scene}/{shot}")

        try:
            local_path = self.get_local_path(video_path)

            if not overwrite and local_path.exists():
                logger.info(f"Video file already exists at {video_path}, skipping generation")
                return True, str(local_path)

            # Prepare both opening and closing frames
            frames = [("opening", "first"), ("closing", "last")]
            prompt_images = []

            for frame_type, position in frames:
                frame_path = self.get_shot_image_path(chapter, scene, shot, frame_type)
                if frame_path.exists():
                    prompt_images.append({
                        "position": position,
                        "uri": self._encode_image_to_base64(str(frame_path))
                    })
                else:
                    logger.error(f"{frame_type.capitalize()} frame not found at {frame_path}")
                    return False, None

            logger.info("Calling RunwayML API for video generation")
            image_to_video = self.client.image_to_video.create(
                model=self.video_model.model_name,
                prompt_image=prompt_images[0]['uri'],  # Now passing properly structured images
                prompt_text=prompt,
                **self.video_model.parameters
            )

            if not image_to_video:
                logger.error("RunwayML API failed to return valid response")
                raise Exception("Failed to generate video with RunwayML")

            task_id = image_to_video.id
            logger.info(f"Video generation task created with ID: {task_id}")

            # Poll until task completion
            while True:
                task = self.client.tasks.retrieve(task_id)
                if task.status == 'SUCCEEDED':
                    break
                elif task.status == 'FAILED':
                    raise Exception(f"Video generation task failed: {task.error}")
                
                logger.debug(f"Task status: {task.status}, waiting {poll_interval} seconds...")
                await asyncio.sleep(poll_interval)  # Use asyncio.sleep instead of time.sleep

            # Download the completed video
            save_path = self.get_download_path(video_path)
            downloaded_path = save_path / f"{Path(video_path).stem}.mp4"

            # Download video from task output URL
            video_url = task.output[0]
            async with aiohttp.ClientSession() as session:
                async with session.get(video_url) as response:
                    response.raise_for_status()
                    with open(downloaded_path, 'wb') as f:
                        async for chunk in response.content.iter_chunked(8192):
                            f.write(chunk)

            generation_time = time.time() - start_time
            logger.info(f"Successfully generated and saved video to {downloaded_path} in {generation_time:.2f} seconds")
            return True, str(downloaded_path)

        except Exception as e:
            logger.error(f"Video generation failed after {time.time() - start_time:.2f} seconds: {str(e)}")
            return False, None

    def get_all_videos(self) -> dict:
        """Get all generated videos in the project directory
        Returns a dictionary with keys in format 'chapter-scene-shot' and values as file paths
        """
        videos = {}
        if self.temp_dir.exists():
            for chapter_dir in self.temp_dir.glob("chapter_*"):
                chapter_num = chapter_dir.name.split("_")[1]
                for scene_dir in chapter_dir.glob("scene_*"):
                    scene_num = scene_dir.name.split("_")[1]
                    for shot_dir in scene_dir.glob("shot_*"):
                        shot_num = shot_dir.name.split("_")[1]
                        video_path = shot_dir / "video.mp4"
                        if video_path.exists():
                            key = f"{chapter_num}-{scene_num}-{shot_num}"
                            videos[key] = str(video_path)
        return videos