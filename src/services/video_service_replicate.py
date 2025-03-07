import os
import logging
import time
from typing import Tuple
import aiohttp
import replicate
from pathlib import Path

from src.services.aws_service import AWSService
from src.services.video_service_base import BaseVideoService, VideoModel

logger = logging.getLogger(__name__)

# Set environment variable to control replicate client timeout
# Default is 600 seconds (10 minutes), increase it to 1800 seconds (30 minutes)
os.environ["REPLICATE_CLIENT_TIMEOUT"] = "1800"

class ReplicateVideoService(BaseVideoService):
    def __init__(self, aws_service: AWSService):
        super().__init__(aws_service)
        logger.info("Initializing ReplicateVideoService")
        self.replicate_token = os.getenv("REPLICATE_API_TOKEN")
        if not self.replicate_token:
            logger.error("Missing Replicate API token. Required: REPLICATE_API_TOKEN")
            raise ValueError("Missing required Replicate API token in environment variables")

        os.environ["REPLICATE_API_TOKEN"] = self.replicate_token
        self.video_model = VideoModel(
            model_name="kwaivgi/kling-v1.6-pro",
            parameters={
                "cfg_scale": 1,
                "duration": 10,
                "aspect_ratio": "16:9",
                "negative_prompt": "extra characters, moving through walls, people sliding on the floor"
            }
        )
        logger.info("Initialized ReplicateVideoService")

    async def generate_video(
        self,
        prompt: str,
        chapter: str,
        scene: str,
        shot: str,
        overwrite: bool = False,
        poll_interval: int = 10,
    ) -> Tuple[bool, str | None]:
        """Generate video for a specific shot using Replicate"""
        video_path = self.get_shot_path(chapter, scene, shot)
        start_time = time.time()
        logger.info(f"Starting video generation for shot {chapter}/{scene}/{shot}")

        try:
            local_path = self.get_local_path(video_path)

            if not overwrite and local_path.exists():
                logger.info(f"Video file already exists at {video_path}, skipping generation")
                return True, str(local_path)

            # Get the opening frame
            frame_path = self.get_shot_image_path(chapter, scene, shot, "opening")
            if not frame_path.exists():
                logger.error(f"Opening frame not found at {frame_path}")
                return False, None

            logger.info("Calling Replicate API for video generation")
            reference_image = self._encode_image_to_base64(str(frame_path))
            
            # Call Replicate API with proper type handling
            if not self.video_model.parameters:
                raise ValueError("Video model parameters are not set")

            output = replicate.run(
                self.video_model.model_name,
                input={
                    "prompt": str(prompt),
                    "start_image": reference_image,
                    "duration": float(self.video_model.parameters.get("duration", 10)),
                    "cfg_scale": float(self.video_model.parameters.get("cfg_scale", 1)), 
                    "aspect_ratio": str(self.video_model.parameters.get("aspect_ratio", "16:9")),
                    "negative_prompt": str(self.video_model.parameters.get("negative_prompt", ""))
                }
            )

            if not output:
                logger.error("Replicate API failed to return valid response")
                raise Exception("Failed to generate video with Replicate")

            # Download the completed video
            save_path = self.get_download_path(video_path)
            downloaded_path = save_path / f"{Path(video_path).stem}.mp4"
            # Extract video URL from response
            # output is an iterator, get the first (and only) URL
            video_url = next(output)
            logger.info(f"Got video URL from Replicate: {video_url}")

            # Download video from URL with increased timeout
            # Create a timeout object with long timeouts
            timeout = aiohttp.ClientTimeout(total=1800, connect=60, sock_connect=60, sock_read=1800)
            
            # Use the timeout in the client session
            async with aiohttp.ClientSession(timeout=timeout) as session:
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
            raise Exception(f"Video generation failed: {str(e)}")
            return False, None