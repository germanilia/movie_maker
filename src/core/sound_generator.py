import logging
from src.services.aws_service import AWSService
from src.services.voice_service import VoiceService

logger = logging.getLogger(__name__)


class SoundGenerator:
    def __init__(
        self, aws_service: AWSService, project_name: str, verify_ssl: bool = False
    ):
        """Initialize the SoundGenerator with Play.ht API credentials and AWS service."""
        self.voice_service = VoiceService(verify_ssl=verify_ssl)
        self.aws_service = aws_service
        self.temp_dir = aws_service.temp_dir
        self.project_name = project_name
        self.voice_id = None  # Will be set after checking/creating cloned voice

    async def initialize_voice(
        self, project_name: str, sample_name: str = "voice_sample.m4a"
    ):
        """Initialize the voice by checking for existing clone or creating new one."""
        try:
            # Construct the full path to the voice sample within the project directory
            project_dir = self.temp_dir / project_name
            sample_path = project_dir / sample_name

            if not sample_path.exists():
                raise FileNotFoundError(f"Voice sample not found at {sample_path}")

            logger.info(f"Using voice sample from: {sample_path}")
            self.voice_id = self.voice_service.get_or_create_cloned_voice(
                str(sample_path), project_name
            )
            if not self.voice_id.startswith("s3://"):
                self.voice_id = f"s3://{self.voice_id}"
            logger.info(f"Initialized voice with ID: {self.voice_id}")
        except Exception as e:
            logger.error(f"Failed to initialize voice: {str(e)}")
            raise

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
        """Generate audio from text using Play.ht API and save locally."""
        if not self.voice_id:
            raise ValueError("Voice has not been initialized. Call initialize_voice first.")

        # Check if audio already exists locally or in S3
        audio_exists = await self.ensure_audio_exists(output_path)
        local_path = self.temp_dir / output_path
        if audio_exists:
            logger.info(f"Audio already exists for {output_path}, skipping generation")
            return str(local_path)

        try:
            local_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Get audio chunks iterator
            audio_chunks = await self.voice_service.generate_voice(
                text=text,
                voice_id=self.voice_id
            )
            
            # Write chunks to file
            with open(local_path, "wb") as audio_file:
                for chunk in audio_chunks:
                    audio_file.write(chunk)
            
            logger.info(f"Generated and saved audio to {local_path}")
            return str(local_path)

        except Exception as e:
            logger.error(f"Failed to generate audio for {output_path}: {str(e)}")
            raise
