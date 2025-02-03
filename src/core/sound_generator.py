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
            raise ValueError("PLAY_HT_USER_ID and PLAY_HT_API_KEY environment variables must be set")
            
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
            s3_uri = f"{self.aws_service.s3_base_uri}/{audio_path}"
            # Check if audio exists in S3
            if await self.aws_service.file_exists(s3_uri):
                # Get local path
                local_path = self.temp_dir / audio_path

                # Create local directory if it doesn't exist
                local_path.parent.mkdir(parents=True, exist_ok=True)

                # If not in temp directory, download it
                if not local_path.exists():
                    try:
                        await self.aws_service.download_file(
                            audio_path, str(local_path)
                        )
                        logger.info(f"Downloaded audio {audio_path} to {local_path}")
                    except Exception as e:
                        logger.error(f"Failed to download audio {audio_path}: {str(e)}")
                        return False
                else:
                    logger.debug(f"Audio already exists locally at {local_path}")

                return True
            else:
                logger.debug(f"Audio {audio_path} does not exist in S3")
                return False

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
        if audio_exists:
            logger.info(f"Audio already exists for {output_path}, skipping generation")
            return output_path

        try:
            # Configure TTS options
            options = TTSOptions(voice=self.voice_id)
            
            # Get local path
            local_path = self.temp_dir / output_path
            local_path.parent.mkdir(parents=True, exist_ok=True)

            # Generate and save audio
            with open(local_path, "wb") as audio_file:
                for chunk in self.client.tts(text, options, voice_engine='PlayDialog-http'):
                    audio_file.write(chunk)

            # Upload to S3
            s3_path = f"{self.aws_service.s3_base_uri}/{output_path}"
            await self.aws_service.upload_file(str(local_path), s3_path)

            logger.info(f"Generated and saved audio to {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Failed to generate audio for {output_path}: {str(e)}")
            raise

    async def generate_scene_audio(
        self, narration_text: str, chapter_num: int, scene_num: int
    ) -> Dict[str, str]:
        """Generate audio for a scene's narration."""
        # Construct audio path
        audio_path = f"chapter_{chapter_num}/scene_{scene_num}/narration.wav"

        # Generate audio file
        audio = await self._generate_audio_from_text(
            narration_text,
            audio_path,
        )

        return {
            "audio": audio,
        }

    async def generate_audio_for_script(self, script: Script) -> Dict[str, Dict]:
        """Generate audio for all scenes in the script."""
        logger.info("Starting audio generation for script")
        audio_results = {}

        for chapter in script.chapters:
            chapter_audio = {}
            if chapter.scenes:
                logger.info(f"Processing chapter {chapter.chapter_number}")
                for scene in chapter.scenes:
                    try:
                        logger.info(
                            f"Generating audio for scene {scene.scene_number} in chapter {chapter.chapter_number}"
                        )
                        scene_audio = await self.generate_scene_audio(
                            scene.narration_text,
                            chapter.chapter_number,
                            scene.scene_number,
                        )
                        chapter_audio[f"scene_{scene.scene_number}"] = scene_audio
                        logger.info(
                            f"Successfully generated audio for scene {scene.scene_number}"
                        )
                    except Exception as e:
                        logger.error(
                            f"Error generating audio for chapter {chapter.chapter_number}, "
                            f"scene {scene.scene_number}: {str(e)}"
                        )
                        continue

            audio_results[f"chapter_{chapter.chapter_number}"] = chapter_audio

        logger.info("Completed audio generation for entire script")
        return audio_results
