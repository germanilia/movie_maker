import aiohttp
import logging
from typing import Dict, List
import base64

logger = logging.getLogger(__name__)

class FaceDetectionService:
    def __init__(self):
        self.base_url = "http://3.213.241.191:8000"
        self.api_key = "Cowabunga!"

    async def detect_faces_multiple(self, image_paths: List[str]) -> Dict:
        """
        Detect faces in multiple images
        
        Args:
            image_paths: List of paths to image files
        
        Returns:
            Dictionary containing face detection results for each image
        """
        try:
            async with aiohttp.ClientSession() as session:
                data = aiohttp.FormData()
                for image_path in image_paths:
                    data.add_field('images', 
                                 open(image_path, 'rb'),
                                 filename=image_path.split('/')[-1])

                headers = {"X-API-Key": self.api_key}
                async with session.post(
                    f"{self.base_url}/detect_faces_multiple/",
                    data=data,
                    headers=headers
                ) as response:
                    if response.status != 200:
                        raise Exception(f"Face detection failed: {await response.text()}")
                    
                    return await response.json()

        except Exception as e:
            logger.error(f"Error in face detection: {str(e)}")
            raise

    async def swap_faces(self, source_image_path: str, target_image_path: str) -> str:
        """
        Swap faces between source and target images
        
        Args:
            source_image_path: Path to the image containing the face to use
            target_image_path: Path to the image where the face should be swapped
        
        Returns:
            Base64 encoded result image
        """
        try:
            async with aiohttp.ClientSession() as session:
                data = aiohttp.FormData()
                data.add_field('source_image', 
                             open(source_image_path, 'rb'),
                             filename='source.png')
                data.add_field('target_image', 
                             open(target_image_path, 'rb'),
                             filename='target.png')

                headers = {"X-API-Key": self.api_key}
                async with session.post(
                    f"{self.base_url}/swap_faces/",
                    data=data,
                    headers=headers
                ) as response:
                    if response.status != 200:
                        raise Exception(f"Face swapping failed: {await response.text()}")
                    
                    result = await response.json()
                    return result['swapped_image']  # Base64 encoded image

        except Exception as e:
            logger.error(f"Error in face swapping: {str(e)}")
            raise