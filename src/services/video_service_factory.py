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
        # If we already have an instance for this provider but with a different aws_service,
        # update its aws_service and temp_dir
        if provider in cls._instances:
            service = cls._instances[provider]
            # Update the service with the new aws_service if needed
            if service.aws_service != aws_service:
                service.update_aws_service(aws_service)
            return service
            
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