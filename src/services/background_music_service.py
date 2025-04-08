import os
import logging
from pydantic import BaseModel
import replicate
from pathlib import Path
import time
from typing import Any, Tuple, Optional, Union, BinaryIO, Iterator
import requests

from src.services.aws_service import AWSService

logger = logging.getLogger(__name__)

class MusicModel(BaseModel):
    model_name: str
    parameters: Any

class BackgroundMusicService:
    _instance: Optional['BackgroundMusicService'] = None
    _initialized: bool = False

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(BackgroundMusicService, cls).__new__(cls)
        return cls._instance

    def __init__(self, aws_service: Optional[AWSService] = None):
        # Always update temp_dir if aws_service is provided, even if already initialized
        if aws_service:
            self.aws_service = aws_service
            self.temp_dir = Path(aws_service.temp_dir)
            logger.info(f"Setting BackgroundMusicService temp_dir to: {self.temp_dir}")
            
        if self._initialized:
            return
            
        logger.info("Initializing BackgroundMusicService")
        self.replicate_token = os.getenv("REPLICATE_API_TOKEN")
        if not self.replicate_token:
            logger.error("Missing Replicate API token. Required: REPLICATE_API_TOKEN")
            raise ValueError("Missing required Replicate API token in environment variables")

        self.aws_service = aws_service
        self.temp_dir = Path(aws_service.temp_dir) if aws_service else Path("temp")
        logger.info(f"BackgroundMusicService initialized. Using temp directory: {self.temp_dir}")

        self.music_model = MusicModel(
            model_name="meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
            parameters={
                "seed": 11,
                "top_k": 250,
                "top_p": 0,
                "duration": 35,
                "temperature": 1,
                "continuation": False,
                "model_version": "melody-large",
                "output_format": "mp3",
                "continuation_start": 0,
                "multi_band_diffusion": False,
                "normalization_strategy": "peak",
                "classifier_free_guidance": 3
            }
        )
        self._initialized = True

    @classmethod
    def get_instance(cls, aws_service: Optional[AWSService] = None) -> 'BackgroundMusicService':
        instance = cls(aws_service)
        # If aws_service is provided, update temp_dir even if instance already exists
        if aws_service and hasattr(instance, 'aws_service') and instance.aws_service != aws_service:
            instance.temp_dir = Path(aws_service.temp_dir)
            logger.info(f"Updated BackgroundMusicService temp_dir to: {instance.temp_dir}")
        return instance

    def update_config(self, aws_service: Optional[AWSService] = None):
        """Update the service configuration after initialization"""
        if aws_service:
            self.temp_dir = Path(aws_service.temp_dir)

    def get_local_path(self, music_path: Union[str, Path]) -> Path:
        """Get the local path for a music file"""
        path = self.temp_dir / str(music_path)
        logger.debug(f"Resolved local path: {path}")
        return path

    def get_download_path(self, music_path: Union[str, Path]) -> Path:
        """Get the download path for music files"""
        downloads_folder = Path(self.temp_dir / str(music_path)).parent
        downloads_folder.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created download directory: {downloads_folder}")
        return downloads_folder

    async def generate_music(
        self,
        prompt: str,
        music_path: Union[str, Path],
        duration: int = 35,
        overwrite: bool = False,
    ) -> Tuple[bool, str | None]:
        """Generate music using Replicate's MusicGen and save locally"""
        start_time = time.time()
        logger.info(f"Starting music generation for path: {music_path}")
        logger.debug(f"Generation parameters - Prompt: {prompt}, Duration: {duration}, Overwrite: {overwrite}")

        try:
            local_path = self.get_local_path(music_path)

            if not overwrite and local_path.exists():
                logger.info(f"Music file already exists at {music_path}, skipping generation")
                return True, str(local_path)

            # Extract numeric values from music_path to use as seed
            seed = int("".join(filter(str.isdigit, str(music_path)))) if any(c.isdigit() for c in str(music_path)) else 11

            logger.info("Calling Replicate API for music generation")
            self.music_model.parameters.update({
                "prompt": prompt,
                "duration": duration,
                "seed": seed
            })

            output = replicate.run(
                self.music_model.model_name,
                input=self.music_model.parameters
            )

            if not output:
                logger.error("Replicate API failed to return valid response")
                raise Exception("Failed to generate music with Replicate")

            # Log the output type and details
            logger.info(f"Received output from Replicate with type: {type(output)}")
            logger.debug(f"Output details: {str(output)[:500]}...")  # Limit logging length

            save_path = self.get_download_path(music_path)
            downloaded_path = save_path / f"{Path(str(music_path)).stem}.mp3"

            # Save the music file
            with open(downloaded_path, "wb") as file:
                # Handle different types of output from replicate.run
                if isinstance(output, (bytes, bytearray)):
                    logger.info("Processing output as bytes/bytearray")
                    file.write(output)
                elif isinstance(output, BinaryIO):
                    logger.info("Processing output as BinaryIO")
                    file.write(output.read())
                elif isinstance(output, Iterator):
                    logger.info("Processing output as Iterator")
                    chunks_processed = 0
                    for chunk in output:
                        chunks_processed += 1
                        if isinstance(chunk, (bytes, bytearray)):
                            file.write(chunk)
                        else:
                            logger.warning(f"Iterator contains non-bytes chunk of type: {type(chunk)}")
                    logger.info(f"Processed {chunks_processed} chunks from iterator")
                elif str(type(output)).find("replicate.helpers.FileOutput") > -1:
                    logger.info("Processing output as replicate.helpers.FileOutput")
                    # Specific handling for replicate.helpers.FileOutput
                    if hasattr(output, "read"):
                        logger.info("Using FileOutput.read() method")
                        file.write(output.read())
                    elif hasattr(output, "url") and output.url:
                        logger.info(f"Downloading from FileOutput.url: {output.url}")
                        response = requests.get(output.url)
                        response.raise_for_status()
                        file.write(response.content)
                    else:
                        # Try download from FileOutput directly
                        logger.info(f"Downloading from FileOutput string representation: {str(output)}")
                        response = requests.get(str(output))
                        response.raise_for_status()
                        file.write(response.content)
                elif hasattr(output, "read"):  # Handle objects with a read() method
                    logger.info("Processing output using read() method")
                    file.write(output.read())
                elif hasattr(output, "url") and output.url:  # Handle objects with a URL property
                    logger.info(f"Downloading from URL: {output.url}")
                    response = requests.get(output.url)
                    response.raise_for_status()
                    file.write(response.content)
                else:
                    error_msg = f"Unexpected output type from Replicate: {type(output)}"
                    logger.error(error_msg)
                    logger.error(f"Output has the following attributes: {dir(output)}")
                    raise ValueError(error_msg)

            generation_time = time.time() - start_time
            logger.info(f"Successfully generated and saved music to {downloaded_path} in {generation_time:.2f} seconds")
            return True, str(downloaded_path)

        except Exception as e:
            logger.error(f"Music generation failed after {time.time() - start_time:.2f} seconds: {str(e)}")
            logger.exception("Detailed exception information:")
            if 'output' in locals():
                logger.error(f"Output type was: {type(output) if output else 'None'}")
                try:
                    logger.error(f"Output representation: {str(output)[:1000]}")
                except:
                    logger.error("Could not convert output to string")
            return False, None