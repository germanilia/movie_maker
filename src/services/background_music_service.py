import os
import logging
from pydantic import BaseModel
import replicate
from pathlib import Path
import time
from typing import Any, Tuple

from src.services.aws_service import AWSService

logger = logging.getLogger(__name__)

class MusicModel(BaseModel):
    model_name: str
    parameters: Any

class BackgroundMusicService:
    def __init__(self, aws_service: AWSService):
        logger.info("Initializing BackgroundMusicService")
        self.replicate_token = os.getenv("REPLICATE_API_TOKEN")
        if not self.replicate_token:
            logger.error("Missing Replicate API token. Required: REPLICATE_API_TOKEN")
            raise ValueError("Missing required Replicate API token in environment variables")

        self.temp_dir = Path(aws_service.temp_dir)
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

    def get_local_path(self, music_path: str) -> Path:
        """Get the local path for a music file"""
        path = self.temp_dir / music_path
        logger.debug(f"Resolved local path: {path}")
        return path

    def get_download_path(self, music_path: str) -> Path:
        """Get the download path for music files"""
        downloads_folder = Path(self.temp_dir / music_path).parent
        downloads_folder.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created download directory: {downloads_folder}")
        return downloads_folder

    async def generate_music(
        self,
        prompt: str,
        music_path: str,
        duration: int = 35,
        overwrite: bool = False,
    ) -> Tuple[bool, str | None]:
        """Generate music using Replicate's MusicGen and save locally"""
        start_time = time.time()
        logger.info(f"Starting music generation for path: {music_path}")
        logger.debug(f"Generation parameters - Prompt: {prompt}, Duration: {duration}, Overwrite: {overwrite}")

        try:
            local_path = self.get_local_path(self.temp_dir / music_path)

            if not overwrite and local_path.exists():
                logger.info(f"Music file already exists at {music_path}, skipping generation")
                return True, str(local_path)

            # Extract numeric values from music_path to use as seed
            seed = int("".join(filter(str.isdigit, music_path))) if any(c.isdigit() for c in music_path) else 11

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
            downloaded_path = save_path / f"{Path(music_path).stem}.mp3"

            # Save the music file
            with open(downloaded_path, "wb") as file:
                file.write(output.read())

            generation_time = time.time() - start_time
            logger.info(f"Successfully generated and saved music to {downloaded_path} in {generation_time:.2f} seconds")
            return True, str(downloaded_path)

        except Exception as e:
            logger.error(f"Music generation failed after {time.time() - start_time:.2f} seconds: {str(e)}")
            return False, None