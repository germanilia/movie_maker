from enum import Enum
from typing import Type
from src.services.video_service_base import BaseVideoService
from src.services.video_service_replicate import ReplicateVideoService
from src.services.video_service_runaway_ml import RunwayMLVideoService
from src.services.aws_service import AWSService

class VideoProvider(str, Enum):
    REPLICATE = "replicate"
    RUNWAYML = "runwayml"

class VideoServiceFactory:
    @staticmethod
    def create_video_service(provider: VideoProvider, aws_service: AWSService) -> BaseVideoService:
        providers = {
            VideoProvider.REPLICATE: ReplicateVideoService,
            VideoProvider.RUNWAYML: RunwayMLVideoService
        }
        
        service_class = providers.get(provider)
        if not service_class:
            raise ValueError(f"Invalid video provider: {provider}")
            
        return service_class(aws_service)