from enum import Enum
from typing import Type, Dict, List
from src.services.video_service_base import BaseVideoService
from src.services.video_service_replicate import ReplicateVideoService
from src.services.video_service_runaway_ml import RunwayMLVideoService
from src.services.aws_service import AWSService
import subprocess
import logging

logger = logging.getLogger(__name__)

class VideoProvider(str, Enum):
    REPLICATE = "replicate"
    RUNWAYML = "runwayml"

class VideoServiceFactory:
    _instances: Dict[VideoProvider, BaseVideoService] = {}

    @classmethod
    def create_video_service(cls, provider: VideoProvider, aws_service: AWSService) -> BaseVideoService:
        """Create or return an existing video service instance"""
        if provider not in cls._instances:
            providers = {
                VideoProvider.REPLICATE: ReplicateVideoService,
                VideoProvider.RUNWAYML: RunwayMLVideoService
            }
            
            service_class = providers.get(provider)
            if not service_class:
                raise ValueError(f"Invalid video provider: {provider}")
                
            cls._instances[provider] = service_class(aws_service)
            
        return cls._instances[provider]

    @classmethod
    def reset_instances(cls):
        """Clear all cached instances - mainly useful for testing"""
        cls._instances.clear()

    @staticmethod
    async def combine_videos(video_paths: List[str], output_path: str) -> bool:
        """Combine multiple videos into a single video file using ffmpeg"""
        try:
            # Create a temporary file listing all input videos
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                for video_path in video_paths:
                    f.write(f"file '{video_path}'\n")
                temp_file = f.name

            # Use ffmpeg to concatenate the videos
            cmd = [
                'ffmpeg',
                '-f', 'concat',
                '-safe', '0',
                '-i', temp_file,
                '-c', 'copy',
                output_path
            ]
            
            process = subprocess.run(cmd, capture_output=True, text=True)
            
            # Clean up the temporary file
            import os
            os.unlink(temp_file)
            
            if process.returncode != 0:
                logger.error(f"FFmpeg error: {process.stderr}")
                return False
                
            return True
            
        except Exception as e:
            logger.error(f"Error combining videos: {str(e)}")
            return False