import os
import logging
from pyht import Client
from dotenv import load_dotenv
from pyht.client import TTSOptions
from typing import Optional

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class VoiceService:
    def __init__(self):
        """Initialize the Play.HT voice service with credentials from environment variables."""
        self.user_id = os.getenv('PLAY_HT_USER_ID')
        self.api_key = os.getenv('PLAY_HT_API_KEY')
        
        if not self.user_id or not self.api_key:
            raise ValueError("PLAY_HT_USER_ID and PLAY_HT_API_KEY must be set in environment variables")
        
        self.api_url = "https://api.play.ht/api/v2/tts/stream"

    async def generate_voice(self, text: str, voice_id: Optional[str] = None, scene_number: Optional[int] = None) -> str:
        """
        Generate voice audio using Play.HT service via curl command.
        Args:
            text (str): The text to convert to speech
            voice_id (str, optional): The voice ID to use. Must start with 's3://'
            scene_number (int, optional): Scene number for organizing outputs
        Returns:
            str: Path to the generated audio file
        """
        try:
            if not voice_id:
                voice_id = "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json"
            
            if not voice_id.startswith("s3://"):
                voice_id = f"s3://{voice_id}"

            
            load_dotenv()
            output_file = f"output_{scene_number}.wav"
            client = Client(
                user_id=os.getenv("PLAY_HT_USER_ID",""),
                api_key=os.getenv("PLAY_HT_API_KEY",""),
            )
            options = TTSOptions(voice="s3://voice-cloning-zero-shot/775ae416-49bb-4fb6-bd45-740f205d20a1/jennifersaad/manifest.json")
            # Open a file to save the audio
            with open(output_file, "wb") as audio_file:
                for chunk in client.tts(text, options, voice_engine = 'PlayDialog-http'):
                    # Write the audio chunk to the file
                    audio_file.write(chunk)

            print(f"Audio saved as {output_file}")
            logger.info(f"Successfully saved voice audio to {output_file}")
            return output_file

        except Exception as e:
            logger.error(f"Failed to generate voice: {str(e)}")
            raise 