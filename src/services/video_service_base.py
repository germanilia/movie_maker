from pathlib import Path
import logging
import base64
from typing import Dict, Tuple, Union, List
from abc import ABC, abstractmethod
from pydantic import BaseModel

from src.services.aws_service import AWSService

logger = logging.getLogger(__name__)

class VideoModel(BaseModel):
    model_name: str
    parameters: Dict | None = None

class BaseVideoService(ABC):
    def __init__(self, aws_service: AWSService):
        self.temp_dir = Path(aws_service.temp_dir)
        logger.info(f"VideoService initialized. Using temp directory: {self.temp_dir}")

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
        return self.temp_dir / f"chapter_{chapter}/scene_{scene}/shot_{shot}_{type_str}.png"

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
                        prepared_images.append(img)
                return prepared_images
            else:
                image_path = self.get_shot_image_path(chapter, scene, shot, type_str)
                if image_path.exists():
                    return self._encode_image_to_base64(str(image_path))
                return images
        except Exception as e:
            logger.error(f"Failed to prepare images: {str(e)}")
            raise

    def get_all_videos(self) -> dict:
        """Get all generated videos in the project directory"""
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

    @abstractmethod
    async def generate_video(
        self,
        prompt: str,
        chapter: str,
        scene: str,
        shot: str,
        overwrite: bool = False,
        poll_interval: int = 10,
        frame_mode: str = "both"
    ) -> Tuple[bool, str | None]:
        """Generate video for a specific shot using the implemented service"""
        pass