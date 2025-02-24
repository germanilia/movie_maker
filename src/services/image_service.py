import os
import logging
from pydantic import BaseModel
import requests
import replicate
from src.services.aws_service import AWSService
from pathlib import Path
import base64
from typing import Any, Tuple, Optional
import time

logger = logging.getLogger(__name__)


class ImageModels(BaseModel):
    model_name: str
    parameters: Any


class ImageService:
    _instance: Optional['ImageService'] = None
    _initialized: bool = False

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(ImageService, cls).__new__(cls)
        return cls._instance

    def __init__(
        self,
        aws_service: Optional[AWSService] = None,
        black_and_white: bool = False,
        genre: str = "documentary",
    ):
        if self._initialized:
            return
            
        logger.info(
            f"Initializing ImageService with black_and_white={black_and_white}, genre={genre}"
        )
        self.replicate_token = os.getenv("REPLICATE_API_TOKEN")
        if not self.replicate_token:
            logger.error("Missing Replicate API token. Required: REPLICATE_API_TOKEN")
            raise ValueError(
                "Missing required Replicate API token in environment variables"
            )

        self.aws_service = aws_service
        self.black_and_white = black_and_white
        self.genre = genre
        self.temp_dir = Path(aws_service.temp_dir) if aws_service else Path("temp")
        logger.info(f"ImageService initialized. Using temp directory: {self.temp_dir}")

        self.upscale_model = ImageModels(
            model_name="alexgenovese/upscaler:4f7eb3da655b5182e559d50a0437440f242992d47e5e20bd82829a79dee61ff3",
            parameters={
                "scale": 4,
                "face_enhance": True
            },
        )

        self.flux_ultra_model = ImageModels(
            model_name="black-forest-labs/flux-1.1-pro-ultra",
            parameters={
                "width": 1280,
                "height": 768,
                "aspect_ratio": "16:9",
                "output_format": "png",
                "output_quality": 100,
                "safety_tolerance": 6,
                "prompt_upsampling": False,
                "image_prompt_strength": 0,
            },
        )

        self.flux_dev_realism = ImageModels(
            model_name="xlabs-ai/flux-dev-realism:39b3434f194f87a900d1bc2b6d4b983e90f0dde1d5022c27b52c143d670758fa",
            parameters={
                "seed": 333,
                "guidance": 3.5,
                "num_outputs": 1,
                "aspect_ratio": "16:9",
                "lora_strength": 0.8,
                "output_format": "jpg",
                "output_quality": 100,
                "num_inference_steps": 38,
            },
        )

        self.image_model = self.flux_dev_realism
        self._initialized = True

    @classmethod
    def get_instance(
        cls,
        aws_service: Optional[AWSService] = None,
        black_and_white: bool = False,
        genre: str = "documentary"
    ) -> 'ImageService':
        if not cls._instance:
            cls._instance = cls(aws_service, black_and_white, genre)
        return cls._instance

    def update_config(
        self,
        aws_service: Optional[AWSService] = None,
        black_and_white: Optional[bool] = None,
        genre: Optional[str] = None
    ):
        """Update the service configuration after initialization"""
        if aws_service:
            self.aws_service = aws_service
            self.temp_dir = Path(aws_service.temp_dir)
        if black_and_white is not None:
            self.black_and_white = black_and_white
        if genre:
            self.genre = genre

    def get_local_path(self, image_path: str) -> Path:
        """
        Get the local path for an image file
        
        Args:
            image_path: Relative path to the image file
            
        Returns:
            Path object for the local file path
        """
        if isinstance(image_path, Path):
            if image_path.is_absolute():
                return image_path
            return self.temp_dir / image_path
        return self.temp_dir / image_path

    def get_download_path(self, image_path: str) -> Path:
        """Get the download path for images"""
        downloads_folder = Path(self.temp_dir / image_path).parent
        downloads_folder.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created download directory: {downloads_folder}")
        return downloads_folder

    def _encode_image_to_base64(self, image_path: Path) -> str:
        """Convert image to base64 with data URL prefix"""
        logger.debug(f"Encoding image to base64: {image_path}")
        try:
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode("utf-8")
                logger.debug(f"Successfully encoded image {image_path}")
                return f"data:image/png;base64,{base64_image}"
        except Exception as e:
            logger.error(
                f"Failed to encode image to base64: {image_path}. Error: {str(e)}"
            )
            raise e

    def get_fallback_image(self) -> str:
        """Get fallback image as base64 with data URL prefix"""
        logger.info("Attempting to retrieve fallback image")
        try:
            stock_image_path = Path("stock_images/failed_generation.png")
            logger.debug(f"Using fallback image from: {stock_image_path}")
            return self._encode_image_to_base64(stock_image_path)
        except Exception as e:
            logger.error(f"Failed to get fallback image: {str(e)}")
            raise e

    async def upscale_image(
        self,
        image_path: str = "",
        b64_image: str = "",
    ) -> str:
        """
        Upscale image using Replicate
        
        Args:
            image_path: Path to image file to upscale and overwrite
            b64_image: Base64 encoded image string to upscale
            
        Returns:
            str: Path to upscaled image or base64 string of upscaled image
        """
        if not image_path and not b64_image:
            logger.error("Missing image_path or b64_image for upscaling")
            raise ValueError("Missing image_path or b64_image for upscaling")
        
        start_time = time.time()
        logger.info("Starting image upscaling")

        try:
            # Handle base64 input
            if b64_image:
                # Remove data URL prefix if present
                if b64_image.startswith('data:image'):
                    b64_image = b64_image.split(',')[1]
                
                # Save base64 to temporary file
                temp_input_path = self.temp_dir / f"temp_input_{int(time.time())}.png"
                with open(temp_input_path, "wb") as f:
                    f.write(base64.b64decode(b64_image))
                local_path = temp_input_path
            else:
                local_path = self.get_local_path(image_path)

            if not local_path.exists():
                logger.error(f"Image not found at path: {local_path}")
                raise FileNotFoundError(f"Image not found at path: {local_path}")

            logger.info("Calling Replicate API for image upscaling")
            output = replicate.run(
                self.upscale_model.model_name,
                input=self.upscale_model.parameters,
                files={"image": local_path}, # type: ignore
            )

            if not output:
                logger.error("Replicate API failed to return valid response")
                raise Exception("Failed to upscale image with Replicate")

            # Download the upscaled image
            if isinstance(output, list) and len(output) > 0 and hasattr(output[0], "url"):
                response = requests.get(output[0].url)
            else:
                response = requests.get(output) # type: ignore
            response.raise_for_status()

            # Handle saving/returning based on input type
            if b64_image:
                # For base64 input, save temporarily and return as base64
                temp_output_path = self.temp_dir / f"temp_output_{int(time.time())}.png"
                with open(temp_output_path, "wb") as f:
                    f.write(response.content)
                
                # Clean up temporary input file
                temp_input_path.unlink()
                
                # Return as base64
                result = self._encode_image_to_base64(temp_output_path)
                temp_output_path.unlink()  # Clean up temporary output file
                return result
            else:
                # For file input, overwrite original file
                with open(local_path, "wb") as f:
                    f.write(response.content)
                
                upscaling_time = time.time() - start_time
                logger.info(
                    f"Successfully upscaled and saved image to {local_path} in {upscaling_time:.2f} seconds"
                )
                return str(local_path)

        except Exception as e:
            logger.error(
                f"Image upscaling failed after {time.time() - start_time:.2f} seconds: {str(e)}"
            )
            return self.get_fallback_image()

    async def generate_image(
        self,
        prompt: str,
        image_path: str,
        overwrite_image: bool = False,
        model_type: str = "flux_dev_realism",  # Add model_type parameter
        reference_image: str | None = None,
        seed: int = 333,
    ) -> Tuple[bool, str | None]:
        """Generate image using Replicate and save locally"""
        start_time = time.time()
        logger.info(f"Starting image generation for path: {image_path} with model: {model_type}")
        
        try:
            # Set the model before generation
            self.set_model(model_type)
            
            # Ensure image path ends with .png
            if not image_path.endswith('.png'):
                image_path = f"{os.path.splitext(image_path)[0]}.png"
            
            local_path = self.get_local_path(image_path)

            if not overwrite_image and local_path.exists():
                logger.info(
                    f"Image already exists at {image_path}, skipping generation"
                )
                return True, str(local_path)

            if self.black_and_white:
                prompt = f"black and white style, {prompt}"
            prompt = f"The image should be very high quality, realistic, styled as a {self.genre} image, {prompt}"
            logger.debug(f"Enhanced prompt: {prompt}")
            # Extract numeric values from image_path to use as seed

            logger.info("Calling Replicate API for image generation")
            self.image_model.parameters["prompt"] = prompt
            self.image_model.parameters["seed"] = seed
            if reference_image:
                self.image_model.parameters["image_prompt"] = reference_image
            output = replicate.run(
                self.image_model.model_name,
                input=self.image_model.parameters,
            )

            if not output:
                logger.error("Replicate API failed to return valid response")
                raise Exception("Failed to generate image with Replicate")

            save_path = self.get_download_path(image_path)
            downloaded_path = save_path / f"{Path(image_path).stem}.png"

            # Download and save the image
            if (
                isinstance(output, list)
                and len(output) > 0
                and hasattr(output[0], "url")
            ):
                response = requests.get(output[0].url)
            else:
                response = requests.get(output) # type: ignore
            response.raise_for_status()

            with open(downloaded_path, "wb") as f:
                f.write(response.content)

            generation_time = time.time() - start_time
            logger.info(
                f"Successfully generated and saved image to {downloaded_path} in {generation_time:.2f} seconds"
            )
            return True, str(downloaded_path)

        except Exception as e:
            logger.error(
                f"Image generation failed after {time.time() - start_time:.2f} seconds: {str(e)}"
            )
            return False, None

    def encode_image_to_base64(self, image_path: Path | str) -> str:
        """Convert image to base64 with data URL prefix"""
        logger.debug(f"Encoding image to base64: {image_path}")
        try:
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode("utf-8")
                logger.debug(f"Successfully encoded image {image_path}")
                return f"data:image/png;base64,{base64_image}"
        except Exception as e:
            logger.error(
                f"Failed to encode image to base64: {image_path}. Error: {str(e)}"
            )
            return self.get_fallback_image()

    def ensure_image_exists(self, image_path: str) -> bool:
        """Check if image exists in the temp directory"""
        full_path = self.temp_dir / image_path
        return full_path.exists()


    def set_model(self, model_type: str):
        """Set the image generation model"""
        if model_type == "flux_ultra_model":
            self.image_model = self.flux_ultra_model
        elif model_type == "flux_dev_realism":
            self.image_model = self.flux_dev_realism
        else:
            raise ValueError(f"Unknown model type: {model_type}")
