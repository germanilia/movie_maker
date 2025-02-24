from enum import Enum
from typing import Type, Dict
from src.services.video_service_base import BaseVideoService
from src.services.video_service_replicate import ReplicateVideoService
from src.services.video_service_runaway_ml import RunwayMLVideoService
from src.services.aws_service import AWSService

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