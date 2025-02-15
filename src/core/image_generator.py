import logging
from src.services.aws_service import AWSService
from src.services.image_service import ImageService
import base64
from pathlib import Path

logger = logging.getLogger(__name__)

class ImageGenerator:
    def __init__(
        self, 
        aws_service: AWSService, 
        black_and_white: bool = False, 
        genre: str = "documentary"
    ):
        """
        Initialize the ImageGenerator
        Args:
            aws_service (AWSService): AWS service instance for AWS interactions
            black_and_white (bool): Whether to generate black and white images
            genre (str): The genre style to apply to images
        """
        self.aws_service = aws_service
        self.image_service = ImageService(aws_service, black_and_white, genre)
        self.temp_dir = Path(aws_service.temp_dir)

    async def ensure_image_exists(self, image_path: str) -> bool:
        """Check if image exists in the temp directory"""
        full_path = self.temp_dir / image_path
        return full_path.exists()

    def _encode_image_to_base64(self, image_path: Path) -> str:
        """Convert image to base64 with data URL prefix"""
        try:
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode("utf-8")
                return f"data:image/png;base64,{base64_image}"
        except Exception as e:
            logger.error(f"Failed to encode image to base64: {str(e)}")
            return self.get_fallback_image()

    def get_fallback_image(self) -> str:
        """Get fallback image as base64 with data URL prefix"""
        try:
            stock_image_path = Path("stock_images/failed_generation.png")
            return self._encode_image_to_base64(stock_image_path)
        except Exception as e:
            logger.error(f"Failed to get fallback image: {str(e)}")
            return ""

    async def generate_image(
        self, 
        prompt: str, 
        image_path: str, 
        seed: int = 0,
        overwrite_image: bool = False
    ) -> str:
        """Generate image and return as base64 data URL"""
        success, path = await self.image_service.generate_image(
            prompt=prompt,
            image_path=image_path,
            overwrite_image=overwrite_image
        )
        
        if success and path:
            return self._encode_image_to_base64(Path(path))
        return self.get_fallback_image()

    