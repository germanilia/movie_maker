from pathlib import Path
import logging
import base64
import os
import subprocess
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
                        video_path = shot_dir.parent / f"shot_{shot_num}_video.mp4"
                        if video_path.exists():
                            key = f"{chapter_num}-{scene_num}-{shot_num}"
                            # Convert to web-friendly path
                            relative_path = str(video_path).replace('\\', '/')
                            videos[key] = f"/{relative_path}"
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

    async def generate_scene_video(
        self,
        chapter: str,
        scene: str,
    ) -> Tuple[bool, str | None]:
        try:
            scene_path = self.temp_dir / f"chapter_{chapter}/scene_{scene}"
            narration_path = scene_path / "narration.wav"
            bg_music_path = scene_path / "background_music.mp3"
            output_path = scene_path / "final_scene.mp4"
            temp_concat_video = scene_path / "temp_concat.mp4"

            # Validate input files
            if not narration_path.exists():
                raise ValueError("Missing narration.wav file")
            if not bg_music_path.exists():
                raise ValueError("Missing background_music.mp3 file")

            # Get and sort video files
            video_files = list(scene_path.glob("shot_*_video.mp4"))
            if not video_files:
                raise ValueError("No video files found for this scene")
            
            video_files = sorted(video_files, key=lambda p: int(p.stem.split("_")[1]))

            try:
                # First normalize all videos to same resolution and frame rate
                normalized_videos = []
                for i, video in enumerate(video_files):
                    normalized_path = scene_path / f"normalized_{i}.mp4"
                    normalized_videos.append(normalized_path)
                    
                    # Normalize video
                    subprocess.run([
                        "ffmpeg", "-y",
                        "-i", str(video),
                        "-vf", "scale=1280:768:force_original_aspect_ratio=decrease,"
                               "pad=1280:768:(ow-iw)/2:(oh-ih)/2,"
                               "fps=30",
                        "-c:v", "libx264",
                        "-preset", "medium",
                        "-crf", "23",
                        str(normalized_path)
                    ], check=True, capture_output=True)

                # Process each normalized video with fades
                processed_videos = []
                for i, video in enumerate(normalized_videos):
                    processed_path = scene_path / f"processed_shot_{i}.mp4"
                    processed_videos.append(processed_path)
                    
                    # Get video duration
                    duration_cmd = [
                        "ffprobe", "-v", "error",
                        "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1",
                        str(video)
                    ]
                    result = subprocess.run(duration_cmd, capture_output=True, text=True, check=True)
                    duration = float(result.stdout.strip())

                    # Add fade effects
                    subprocess.run([
                        "ffmpeg", "-y",
                        "-i", str(video),
                        "-vf", f"fade=t=in:st=0:d=1,fade=t=out:st={duration-1}:d=1",
                        "-c:v", "libx264",
                        "-preset", "medium",
                        "-crf", "23",
                        str(processed_path)
                    ], check=True, capture_output=True)

                # Concatenate processed videos
                # Create concat file
                concat_file = scene_path / "concat.txt"
                with open(concat_file, "w") as f:
                    for video in processed_videos:
                        f.write(f"file '{video.name}'\n")

                # Concatenate videos
                subprocess.run([
                    "ffmpeg", "-y",
                    "-f", "concat",
                    "-safe", "0",
                    "-i", str(concat_file),
                    "-c", "copy",
                    str(temp_concat_video)
                ], check=True, capture_output=True)

                # Add audio
                subprocess.run([
                    "ffmpeg", "-y",
                    "-i", str(temp_concat_video),
                    "-i", str(narration_path),
                    "-i", str(bg_music_path),
                    "-filter_complex",
                    "[1:a]aformat=sample_fmts=fltp:sample_rates=44100[narr];"
                    "[2:a]aformat=sample_fmts=fltp:sample_rates=44100,volume=0.1[music];"
                    "[narr][music]amix=inputs=2:duration=first:weights=1 1[aout]",
                    "-map", "0:v",
                    "-map", "[aout]",
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    str(output_path)
                ], check=True, capture_output=True)

                # Cleanup temporary files
                concat_file.unlink(missing_ok=True)
                if temp_concat_video.exists():
                    temp_concat_video.unlink()
                for video in normalized_videos + processed_videos:
                    if video.exists():
                        video.unlink()

                if output_path.exists():
                    logger.info("Successfully created scene video with audio")
                    return True, str(output_path)
                else:
                    raise ValueError("Output file was not created")

            except subprocess.CalledProcessError as e:
                logger.error("FFmpeg error: %s", str(e))
                if hasattr(e, "stderr"):
                    logger.error("FFmpeg stderr: %s", e.stderr.decode())
                raise ValueError("Error combining videos and audio")

        except Exception as e:
            logger.error("Error generating scene video: %s", str(e))
            return False, None