from typing import Optional
import base64
import json
import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from botocore.config import Config
import boto3
from shutil import copy2

from .voice_service import VoiceService

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class AWSService:
    def __init__(self, project_name: str):
        """
        Initialize AWS service with project-specific configuration
        Args:
            project_name (str): Name of the project for organizing outputs
        """
        # Load AWS profile and region from environment
        session = boto3.Session(
            profile_name=os.getenv('AWS_PROFILE', 'default'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        
        self.bedrock_runtime = session.client(
            'bedrock-runtime',
            config=Config(read_timeout=300)
        )
        
        # Initialize S3 client
        self.s3_client = session.client('s3')
        
        # Initialize voice service
        self.voice_service = VoiceService()
        
        # Configure S3 paths
        self.s3_bucket = os.getenv('S3_BUCKET')
        if not self.s3_bucket:
            raise ValueError("S3_BUCKET environment variable must be set")
            
        self.project_path = f"{project_name.lower().replace(' ', '_')}"
        self.s3_base_uri = f"s3://{self.s3_bucket}/{self.project_path}"
        
        # Add temp directory configuration
        self.temp_dir = Path("temp") / self.project_path
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Ensure project directory exists
        self._ensure_project_directory()

    def _ensure_project_directory(self):
        """Create project directory and subdirectories in S3 if they don't exist."""
        try:
            # Create project root directory
            self.s3_client.head_object(Bucket=self.s3_bucket, Key=f"{self.project_path}/")
        except:
            self.s3_client.put_object(Bucket=self.s3_bucket, Key=f"{self.project_path}/")
            logger.info(f"Created project directory: {self.project_path}")
            
        # Create research directory
        try:
            self.s3_client.head_object(Bucket=self.s3_bucket, Key=f"{self.project_path}/research/")
        except:
            self.s3_client.put_object(Bucket=self.s3_bucket, Key=f"{self.project_path}/research/")
            logger.info(f"Created research directory: {self.project_path}/research/")

        # Create storyline directory
        try:
            self.s3_client.head_object(Bucket=self.s3_bucket, Key=f"{self.project_path}/storyline/")
        except:
            self.s3_client.put_object(Bucket=self.s3_bucket, Key=f"{self.project_path}/storyline/")
            logger.info(f"Created storyline directory: {self.project_path}/storyline/")

    def get_scene_path(self, scene_number: int, asset_type: str, extension: str, clip_index: Optional[int] = None) -> str:
        """
        Generate S3 path for a scene asset
        Args:
            scene_number (int): Scene number
            asset_type (str): Type of asset (video, audio, image)
            extension (str): File extension
            clip_index (Optional[int]): Index of the clip within the scene (for multiple clips)
        Returns:
            str: S3 URI for the asset
        """
        if asset_type == "video":
            if clip_index is not None:
                # For individual video clips
                return f"{self.s3_base_uri}/scene_{scene_number}/clip_{clip_index}"
            # For final combined video
            return f"{self.s3_base_uri}/scene_{scene_number}"
        else:
            # For other assets, include the filename
            return f"{self.s3_base_uri}/scene_{scene_number}_{asset_type}.{extension}"

    async def get_video_path(self, scene_number: int) -> str:
        """
        Get the full path to the video file including output.mp4
        Args:
            scene_number (int): Scene number
        Returns:
            str: Full S3 URI including output.mp4
        """
        base_path = self.get_scene_path(scene_number, "video", "")
        return f"{base_path}/output.mp4"

    async def file_exists(self, s3_uri: str) -> bool:
        """
        Check if a file exists locally in temp dir first, then in S3.
        Returns True if file exists in either location.
        """
        # First check local temp directory
        bucket, key = self._parse_s3_uri(s3_uri)
        key = key.replace(f"{self.project_path}/", "")
        local_path = self.temp_dir / key
        if local_path.exists():
            return True
        
        # If not found locally, check S3
        try:
            self.s3_client.head_object(Bucket=bucket, Key=key)
            return True
        except:
            return False

    def _parse_s3_uri(self, s3_uri: str) -> tuple[str, str]:
        """Parse S3 URI into bucket and key."""
        parts = s3_uri.replace("s3://", "").split("/")
        bucket = parts[0]
        key = "/".join(parts[1:])
        return bucket, key

    async def download_file(self, s3_uri: str, local_path: str) -> None:
        """Download a file from S3 to local path."""
        try:
            bucket, key = self._parse_s3_uri(s3_uri)
            
            # Remove the project name from the beginning of the key since it's already in temp_dir
            key_parts = key.split('/', 1)
            if len(key_parts) > 1:
                key_without_project = key_parts[1]
            else:
                key_without_project = key
                
            # Use the path without project name prefix for local storage
            final_local_path = str(self.temp_dir / key_without_project)
            
            # Ensure the directory exists
            Path(final_local_path).parent.mkdir(parents=True, exist_ok=True)
            
            self.s3_client.download_file(bucket, key, final_local_path)
            
            # If a specific local_path was provided and it's different from our temp path,
            # copy the file there as well
            if local_path != final_local_path:
                Path(local_path).parent.mkdir(parents=True, exist_ok=True)
                copy2(final_local_path, local_path)
                
            logger.info(f"Successfully downloaded {s3_uri} to {final_local_path}")
            if local_path != final_local_path:
                logger.info(f"Copied to requested location: {local_path}")
                
        except Exception as e:
            logger.error(f"Failed to download file from S3: {str(e)}")
            raise

    async def upload_file(self, local_path: str, s3_uri: str) -> None:
        """Upload a file from local path to S3 and save to temp directory."""
        try:
            # Upload to S3
            bucket, key = self._parse_s3_uri(s3_uri)
            self.s3_client.upload_file(local_path, bucket, key)
            logger.info(f"Successfully uploaded {local_path} to {s3_uri}")

            # Save to temp directory
            temp_path = self.temp_dir / key
            temp_path.parent.mkdir(parents=True, exist_ok=True)
            
            # If the source isn't already in the temp directory, copy it there
            if Path(local_path) != temp_path:
                copy2(local_path, temp_path)
                logger.info(f"Saved copy to temp directory: {temp_path}")

        except Exception as e:
            logger.error(f"Failed to upload file to S3: {str(e)}")
            raise

    async def delete_folder(self, s3_uri: str) -> None:
        """Delete a folder and all its contents from S3."""
        try:
            bucket, prefix = self._parse_s3_uri(s3_uri)
            # Ensure prefix ends with /
            if not prefix.endswith('/'):
                prefix += '/'
                
            # List and delete all objects with this prefix
            paginator = self.s3_client.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        self.s3_client.delete_object(Bucket=bucket, Key=obj['Key'])
                        
            # Delete the folder marker itself
            self.s3_client.delete_object(Bucket=bucket, Key=prefix)
            logger.info(f"Successfully deleted folder {s3_uri}")
        except Exception as e:
            logger.error(f"Failed to delete folder from S3: {str(e)}")
            raise

    #"anthropic.claude-3-haiku-20240307-v1:0"
    async def invoke_llm(self, prompt: str, model_id: str = "anthropic.claude-3-5-sonnet-20241022-v2:0", prev_errors:str = "N/A") -> str:
        """
        Invoke a Large Language Model through Amazon Bedrock.
        Args:
            prompt (str): The text prompt to send to the model
            model_id (str): The model ID to use (defaults to Claude 3 Haiku)
        Returns:
            str: The model's response text
        """
        try:
            prompt = f"{prompt}\n\nPrevious Errors: {prev_errors}"
            # Format the request payload using Claude's native structure
            native_request = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 8000,
                "temperature": 0.5,
                "messages": [
                    {
                        "role": "user",
                        "content": [{"type": "text", "text": prompt}],
                    }
                ],
            }

            # Convert the request to JSON
            request = json.dumps(native_request)

            # Invoke the model
            response = self.bedrock_runtime.invoke_model(
                modelId=model_id,
                body=request
            )

            # Parse the response
            model_response = json.loads(response.get("body").read())
            response_text = model_response["content"][0]["text"]

            logger.info("Successfully received response from LLM")
            return response_text

        except Exception as e:
            logger.error(f"Failed to invoke LLM: {str(e)}")
            raise 

    async def upload_base64_file(self, base64_data: str, image_path: str) -> None:
        """
        Decode base64 string, save it as a temporary file, upload to S3, and save to temp directory.
        
        Args:
            base64_data (str): Base64 encoded file data
            s3_uri (str): Destination S3 URI
            file_extension (str): File extension (e.g., 'mp4', 'mp3', 'jpg')
        """
        try:
            # Remove data URI prefix if present (e.g., 'data:image/jpeg;base64,')
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            
            # Decode base64 string
            file_data = base64.b64decode(base64_data)
            s3_uri = f"{self.s3_base_uri}/{image_path}"
            # Get the target path in temp directory
            bucket, key = self._parse_s3_uri(s3_uri)

            
            # Remove the project name from the beginning of the key since it's already in temp_dir
            key_parts = key.split('/', 1)
            if len(key_parts) > 1:
                key = key_parts[1]
            
            temp_path = self.temp_dir / key
            temp_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save directly to temp directory
            with open(temp_path, 'wb') as f:
                f.write(file_data)
            logger.info(f"Saved file to temp directory: {temp_path}")
            
            # Upload to S3 (use original key here)
            self.s3_client.upload_file(str(temp_path), bucket, key_parts[0] + '/' + key)
            logger.info(f"Successfully uploaded file to {s3_uri}")
            
        except Exception as e:
            logger.error(f"Failed to process and upload base64 file: {str(e)}")
            raise 
