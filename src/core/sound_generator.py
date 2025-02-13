import os
import logging
from typing import Dict
from pyht import Client
from pyht.client import TTSOptions
from src.models.models import Script
from src.services.aws_service import AWSService

logger = logging.getLogger(__name__)


class SoundGenerator:
    def __init__(self, aws_service: AWSService, project_name: str):
        """Initialize the SoundGenerator with Play.ht API credentials and AWS service."""
        user_id = os.getenv("PLAY_HT_USER_ID")
        api_key = os.getenv("PLAY_HT_API_KEY")

        if not user_id or not api_key:
            raise ValueError(
                "PLAY_HT_USER_ID and PLAY_HT_API_KEY environment variables must be set"
            )

        self.client = Client(
            user_id=user_id,
            api_key=api_key,
        )
        self.aws_service = aws_service
        self.temp_dir = aws_service.temp_dir
        self.project_name = project_name
        self.voice_id = "s3://voice-cloning-zero-shot/775ae416-49bb-4fb6-bd45-740f205d20a1/jennifersaad/manifest.json"
        
    async def ensure_audio_exists(self, audio_path: str) -> bool:
        """
        Check if audio exists locally or in S3, download if needed.

        Args:
            audio_path (str): Full S3 path to the audio file

        Returns:
            bool: True if audio exists or was downloaded successfully, False if not found
        """
        try:
            local_path = self.temp_dir / audio_path
            if not local_path.exists():
                local_path.parent.mkdir(parents=True, exist_ok=True)
                return False
            return True

        except Exception as e:
            logger.error(f"Error checking audio existence for {audio_path}: {str(e)}")
            return False

    async def _generate_audio_from_text(
        self,
        text: str,
        output_path: str,
    ) -> str:
        """Generate audio from text using Play.ht API and save to S3."""
        # Check if audio already exists locally or in S3
        audio_exists = await self.ensure_audio_exists(output_path)
        local_path = self.temp_dir / output_path
        if audio_exists:
            logger.info(f"Audio already exists for {output_path}, skipping generation")
            return output_path
        try:
            local_path.parent.mkdir(parents=True, exist_ok=True)
            # Configure TTS options
            options = TTSOptions(voice=self.voice_id)


            # Generate and save audio
            with open(local_path, "wb") as audio_file:
                for chunk in self.client.tts(
                    text, options, voice_engine="PlayDialog-http"
                ):
                    audio_file.write(chunk)


            logger.info(f"Generated and saved audio to {output_path}")
            return local_path

        except Exception as e:
            logger.error(f"Failed to generate audio for {output_path}: {str(e)}")
            raise

    