import os
import logging
import requests
import mimetypes
from pyht import Client
from dotenv import load_dotenv
from pyht.client import TTSOptions
from typing import Optional, Dict, List
from pathlib import Path
from urllib3.exceptions import InsecureRequestWarning
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Suppress only the single warning from urllib3 needed.
requests.packages.urllib3.disable_warnings(category=InsecureRequestWarning)

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class VoiceService:
    def __init__(self, verify_ssl: bool = False):
        """Initialize the Play.HT voice service with credentials from environment variables."""
        self.user_id = os.getenv('PLAY_HT_USER_ID')
        self.api_key = os.getenv('PLAY_HT_API_KEY')
        self.verify_ssl = verify_ssl
        
        if not self.user_id or not self.api_key:
            raise ValueError("PLAY_HT_USER_ID and PLAY_HT_API_KEY must be set in environment variables")
        
        self.api_url = "https://api.play.ht/api/v2"
        self.headers = {
            "AUTHORIZATION": self.api_key,
            "X-USER-ID": self.user_id,
            "accept": "application/json"
        }
        
        # Setup session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.headers.update(self.headers)

    def list_cloned_voices(self) -> List[Dict]:
        """List all cloned voices in the account."""
        try:
            response = self.session.get(
                f"{self.api_url}/cloned-voices",
                verify=self.verify_ssl
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to list cloned voices: {str(e)}")
            raise

    def _get_mime_type(self, file_path: str) -> str:
        """Get the MIME type for a file based on its extension."""
        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type and mime_type.startswith('audio/'):
            return mime_type
        # Default to audio/wav if we can't detect the type
        return 'audio/wav'

    def clone_voice(self, voice_sample_path: str, voice_name: str) -> Dict:
        """Clone a voice from a sample audio file."""
        try:
            if not os.path.exists(voice_sample_path):
                raise FileNotFoundError(f"Voice sample file not found at {voice_sample_path}")

            logger.info(f"Attempting to clone voice using sample: {voice_sample_path}")
            
            mime_type = self._get_mime_type(voice_sample_path)
            logger.debug(f"Detected MIME type: {mime_type}")
            
            # Match the exact format from the working request sample
            files = {
                "sample_file": (
                    os.path.basename(voice_sample_path),
                    open(voice_sample_path, "rb"),
                    mime_type
                )
            }
            
            payload = {
                "voice_name": voice_name
            }
            
            headers = {
                **self.headers,  # Base headers
                "accept": "application/json"  # Ensure accept header is present
            }
            
            logger.debug(f"Sending request to {self.api_url}/cloned-voices/instant")
            
            try:
                response = requests.post(
                    f"{self.api_url}/cloned-voices/instant",
                    data=payload,
                    files=files,
                    headers=headers,
                    verify=self.verify_ssl
                )
                
                # Ensure we close the file after the request
                files["sample_file"][1].close()
                
                try:
                    response_json = response.json()
                except ValueError:
                    logger.error(f"Invalid JSON response: {response.text}")
                    raise ValueError("API returned invalid JSON response")
                
                if response.status_code >= 400:
                    error_message = response_json.get('error', {}).get('message', response.text)
                    logger.error(f"API Error: {response.status_code} - {error_message}")
                    raise requests.exceptions.HTTPError(
                        f"API request failed: {error_message}",
                        response=response
                    )
                
                logger.info(f"Successfully cloned voice with name: {voice_name}")
                return response_json

            finally:
                # Ensure file is closed even if request fails
                if "sample_file" in files and hasattr(files["sample_file"][1], 'close'):
                    files["sample_file"][1].close()
                    
        except FileNotFoundError:
            logger.error(f"Voice sample file not found: {voice_sample_path}")
            raise
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error while cloning voice: {str(e)}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed while cloning voice: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error while cloning voice: {str(e)}")
            raise

    def get_or_create_cloned_voice(self, voice_sample_path: str, voice_name: str) -> str:
        """Get existing cloned voice ID or create a new one."""
        try:
            # First, check existing cloned voices
            logger.info(f"Checking for existing voice with name: {voice_name}")
            cloned_voices = self.list_cloned_voices()
            
            # Look for a voice with the same name
            for voice in cloned_voices:
                if voice.get('name') == voice_name:
                    logger.info(f"Found existing voice with name '{voice_name}' and ID: {voice.get('id')}")
                    return voice.get('id')
            
            # If not found, create new cloned voice
            logger.info(f"No existing voice found with name '{voice_name}'. Creating new clone...")
            result = self.clone_voice(voice_sample_path, voice_name)
            voice_id = result.get('id')
            if not voice_id:
                raise ValueError("API response did not contain voice ID")
            
            logger.info(f"Successfully created new cloned voice with ID: {voice_id}")
            return voice_id
            
        except Exception as e:
            logger.error(f"Failed to get or create cloned voice: {str(e)}")
            raise

    async def generate_voice(self, text: str, voice_id: Optional[str] = None):
        """
        Generate voice audio using Play.HT service.
        Args:
            text (str): The text to convert to speech
            voice_id (str, optional): The voice ID to use. Must start with 's3://'
        Returns:
            Iterator: An iterator of audio chunks
        """
        try:
            if not voice_id:
                voice_id = "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json"
            
            if not voice_id.startswith("s3://"):
                voice_id = f"s3://{voice_id}"
            
            load_dotenv()
            client = Client(
                user_id=os.getenv("PLAY_HT_USER_ID",""),
                api_key=os.getenv("PLAY_HT_API_KEY",""),
            )
            options = TTSOptions(voice=voice_id)
            
            return client.tts(text, options, voice_engine='PlayDialog')

        except Exception as e:
            logger.error(f"Failed to generate voice: {str(e)}")
            raise