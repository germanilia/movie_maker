import os
import logging
from pydantic import BaseModel
import replicate
from pathlib import Path
import time
from typing import Any, Tuple, Optional, Union, BinaryIO, Iterator

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
        if self._initialized:
            return
            
        logger.info("Initializing BackgroundMusicService")
        self.replicate_token = os.getenv("REPLICATE_API_TOKEN")
        if not self.replicate_token:
            logger.error("Missing Replicate API token. Required: REPLICATE_API_TOKEN")
            raise ValueError("Missing required Replicate API token in environment variables")

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
        if not cls._instance:
            cls._instance = cls(aws_service)
        return cls._instance

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

            save_path = self.get_download_path(music_path)
            downloaded_path = save_path / f"{Path(str(music_path)).stem}.mp3"

            # Save the music file
            with open(downloaded_path, "wb") as file:
                # Handle different types of output from replicate.run
                if isinstance(output, (bytes, bytearray)):
                    file.write(output)
                elif isinstance(output, BinaryIO):
                    file.write(output.read())
                elif isinstance(output, Iterator):
                    for chunk in output:
                        if isinstance(chunk, (bytes, bytearray)):
                            file.write(chunk)
                else:
                    raise ValueError(f"Unexpected output type from Replicate: {type(output)}")

            generation_time = time.time() - start_time
            logger.info(f"Successfully generated and saved music to {downloaded_path} in {generation_time:.2f} seconds")
            return True, str(downloaded_path)

        except Exception as e:
            logger.error(f"Music generation failed after {time.time() - start_time:.2f} seconds: {str(e)}")
            return False, None