import os
import logging
import base64
from pathlib import Path
import time
from typing import Any, Tuple, Optional, Union, List
from pydantic import BaseModel

from runwayml import RunwayML
from src.services.aws_service import AWSService

logger = logging.getLogger(__name__)

class VideoModel(BaseModel):
    model_name: str
    parameters: Any

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
            parameters={
                "number_of_frames": 48,  # This will generate about 2 seconds of video
                "fps": 24,
                "motion_scale": 1.0,
                "noise": 0.1
            }
        )

    def get_local_path(self, video_path: str) -> Path:
        """Get the local path for a video file"""
        path = self.temp_dir / video_path
        logger.debug(f"Resolved local path: {path}")
        return path

    def get_shot_path(self, chapter: str, scene: str, shot: str) -> str:
        """Construct the path for a specific shot"""
        return f"chapter_{chapter}/scene_{scene}/shot_{shot}/video.mp4"

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
        """Convert image to base64 data URI"""
        with open(image_path, 'rb') as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            extension = Path(image_path).suffix[1:]  # Remove the dot
            return f"data:image/{extension};base64,{encoded_string}"

    def _prepare_images(self, images: Union[str, List[str]]) -> Union[str, List[str]]:
        """Prepare images for API request - convert local paths to base64 if needed"""
        if isinstance(images, list):
            return [
                self._encode_image_to_base64(img) if os.path.exists(img) else img
                for img in images
            ]
        elif os.path.exists(images):
            return self._encode_image_to_base64(images)
        return images

    async def generate_video(
        self,
        prompt: str,
        chapter: str,
        scene: str,
        shot: str,
        opening_frame: Union[str, List[str]],
        closing_frame: Optional[Union[str, List[str]]] = None,
        overwrite: bool = False,
        poll_interval: int = 10
    ) -> Tuple[bool, str | None]:
        """Generate video for a specific shot using RunwayML
        
        Args:
            prompt: Text prompt describing the desired video
            chapter: Chapter number/id
            scene: Scene number/id
            shot: Shot number/id
            opening_frame: Single image URL/path or list of image URLs/paths
            closing_frame: Optional final frame image URL/path or list
            overwrite: Whether to overwrite existing video
            poll_interval: Seconds to wait between polling for task completion
        """
        video_path = self.get_shot_path(chapter, scene, shot)
        start_time = time.time()
        logger.info(f"Starting video generation for shot {chapter}/{scene}/{shot}")
        logger.debug(f"Generation parameters - Prompt: {prompt}, Opening frame(s): {opening_frame}, "
                    f"Closing frame(s): {closing_frame}, Overwrite: {overwrite}")

        try:
            local_path = self.get_local_path(video_path)

            if not overwrite and local_path.exists():
                logger.info(f"Video file already exists at {video_path}, skipping generation")
                return True, str(local_path)

            # Prepare images
            prompt_images = self._prepare_images(opening_frame)
            if closing_frame:
                closing_images = self._prepare_images(closing_frame)
                if isinstance(prompt_images, list):
                    prompt_images.extend(closing_images if isinstance(closing_images, list) else [closing_images])
                else:
                    prompt_images = [prompt_images, closing_images]
            
            logger.info("Calling RunwayML API for video generation")
            image_to_video = await self.client.image_to_video.create(
                model=self.video_model.model_name,
                prompt_image=prompt_images,
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
                task = await self.client.tasks.retrieve(task_id)
                if task.status == 'SUCCEEDED':
                    break
                elif task.status == 'FAILED':
                    raise Exception(f"Video generation task failed: {task.error}")
                
                logger.debug(f"Task status: {task.status}, waiting {poll_interval} seconds...")
                time.sleep(poll_interval)

            # Download the completed video
            save_path = self.get_download_path(video_path)
            downloaded_path = save_path / f"{Path(video_path).stem}.mp4"

            # Download video from task output URL
            video_url = task.output.video_url  # Adjust based on actual API response structure
            async with self.client.http_client.stream('GET', video_url) as response:
                response.raise_for_status()
                with open(downloaded_path, 'wb') as f:
                    async for chunk in response.aiter_bytes():
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