import os
import time
import base64
import logging
import aiohttp
from typing import Dict, Literal
from runwayml import RunwayML
from src.models.models import Script, Shot
from src.services.aws_service import AWSService
from runwayml.types.image_to_video_create_params import PromptImagePromptImage

logger = logging.getLogger(__name__)


class PromptImage:
    def __init__(self, uri: str, position: Literal["first", "last"]):
        self.uri = uri
        self.position: Literal["first", "last"] = position

    def base64(self) -> str:
        with open(self.uri, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def to_prompt_image_promptImage(self) -> PromptImagePromptImage:
        return {
            "uri": f"data:image/png;base64,{self.base64()}",
            "position": self.position,
        }


class VideoGenerator:
    def __init__(self, aws_service: AWSService, project_name: str):
        """Initialize the VideoGenerator with RunwayML API key and AWS service."""
        api_key = os.getenv("RUNWAYML_API_KEY")
        self.client = RunwayML(api_key=api_key)
        self.aws_service = aws_service
        self.temp_dir = aws_service.temp_dir
        self.project_name = project_name

    def _encode_image_to_base64(self, prompt_image: PromptImage) -> str:
        """Encode image to base64 string."""

        with open(prompt_image.uri, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    async def ensure_video_exists(self, video_path: str) -> bool:
        """
        Check if video exists locally or in S3, download if needed.

        Args:
            video_path (str): Full S3 path to the video

        Returns:
            bool: True if video exists or was downloaded successfully, False if not found
        """
        try:
            s3_uri = f"{self.aws_service.s3_base_uri}/{video_path}"
            # Check if video exists in S3
            if await self.aws_service.file_exists(s3_uri):
                # Get local path
                local_path = self.temp_dir / video_path

                # Create local directory if it doesn't exist
                local_path.parent.mkdir(parents=True, exist_ok=True)

                # If not in temp directory, download it
                if not local_path.exists():
                    try:
                        await self.aws_service.download_file(
                            video_path, str(local_path)
                        )
                        logger.info(f"Downloaded video {video_path} to {local_path}")
                    except Exception as e:
                        logger.error(f"Failed to download video {video_path}: {str(e)}")
                        return False
                else:
                    logger.debug(f"Video already exists locally at {local_path}")

                return True
            else:
                logger.debug(f"Video {video_path} does not exist in S3")
                return False

        except Exception as e:
            logger.error(f"Error checking video existence for {video_path}: {str(e)}")
            return False

    async def _generate_video_from_image(
        self,
        opening_image: PromptImage,
        closing_image: PromptImage,
        prompt_text: str,
        output_path: str,
    ) -> str:
        """Generate video from image using RunwayML API and save to S3."""
        # Check if video already exists locally or in S3
        video_exists = await self.ensure_video_exists(output_path)
        if video_exists:
            logger.info(f"Video already exists for {output_path}, skipping generation")
            return output_path

        retry_configurations = [
            (opening_image, closing_image),  # Try with both images
            (opening_image, None),  # Try with only closing image
            (None, closing_image),  # Try with only opening image
        ]

        for opening_img, closing_img in retry_configurations:
            try:
                prompt_images = []
                if opening_img:
                    prompt_images.append(opening_img.to_prompt_image_promptImage())
                if closing_img:
                    prompt_images.append(closing_img.to_prompt_image_promptImage())

                # Create a new image-to-video task
                task = self.client.image_to_video.create(
                    model="gen3a_turbo",
                    prompt_image=prompt_images,
                    prompt_text=prompt_text,
                )
                task_id = task.id

                # Poll the task until it's complete
                time.sleep(10)  # Initial wait
                task = self.client.tasks.retrieve(task_id)
                while task.status not in ["SUCCEEDED", "FAILED"]:
                    time.sleep(10)
                    task = self.client.tasks.retrieve(task_id)

                if task.status == "FAILED":
                    logger.warning(
                        f"Video generation attempt failed with images: opening={bool(opening_img)}, closing={bool(closing_img)}"
                    )
                    continue

                if task and task.output:
                    video_url = task.output[0]
                else:
                    raise Exception("No video URL in response")

                # Download video from RunwayML and upload to S3
                async with aiohttp.ClientSession() as session:
                    async with session.get(video_url) as response:
                        if response.status != 200:
                            raise Exception(
                                f"Failed to download video from RunwayML: {response.status}"
                            )
                        video_data = await response.read()

                        # Save locally first
                        local_path = self.temp_dir / output_path
                        local_path.parent.mkdir(parents=True, exist_ok=True)
                        with open(local_path, "wb") as f:
                            f.write(video_data)

                        # Upload to S3
                        s3_path = f"{self.aws_service.s3_base_uri}/{output_path}"
                        await self.aws_service.upload_file(str(local_path), s3_path)

                logger.info(f"Generated and saved video to {output_path}")
                return output_path

            except Exception as e:
                logger.error(
                    f"Attempt failed with images: opening={bool(opening_img)}, closing={bool(closing_img)}: {str(e)}"
                )
                continue

        # If all retries failed
        raise Exception(
            f"Failed to generate video after trying all image combinations for output path: {output_path}"
        )

    async def generate_shot_video(
        self, shot: Shot, chapter_num: int, scene_num: int
    ) -> Dict[str, str]:
        """Generate videos for opening and closing scenes of a shot."""
        # Construct paths
        shot_base_path = f"chapter_{chapter_num}/scene_{scene_num}"

        # Local image paths
        opening_image = (
            self.temp_dir / f"{shot_base_path}/shot_{shot.shot_number}_opening.png"
        )
        closing_image = (
            self.temp_dir / f"{shot_base_path}/shot_{shot.shot_number}_closing.png"
        )

        # S3 video paths
        video_path = f"{shot_base_path}/shot_{shot.shot_number}.mp4"
        opening_image = PromptImage(uri=str(opening_image), position="first")
        closing_image = PromptImage(uri=str(closing_image), position="last")
        # Generate opening scene video
        video = await self._generate_video_from_image(
            opening_image,
            closing_image,
            shot.detailed_opening_scene_description,
            video_path,
        )
        return {
            "video": video,
        }

    async def generate_videos_for_script(self, script: Script) -> Dict[str, Dict]:
        """Generate videos for all shots in the script."""
        logger.info("Starting video generation for script")
        video_results = {}

        for chapter in script.chapters:
            chapter_videos = {}
            if chapter.scenes:
                logger.info(f"Processing chapter {chapter.chapter_number}")
                for scene in chapter.scenes:
                    scene_videos = {}
                    if scene.shots:
                        logger.info(
                            f"Processing scene {scene.scene_number} in chapter {chapter.chapter_number}"
                        )
                        for shot in scene.shots:
                            try:
                                logger.info(
                                    f"Generating videos for shot {shot.shot_number}"
                                )
                                if shot.still_image:
                                    logger.info(
                                        f"Skipping video generation for still image shot {shot.shot_number}"
                                    )
                                    continue
                                shot_videos = await self.generate_shot_video(
                                    shot=shot,
                                    chapter_num=chapter.chapter_number,
                                    scene_num=scene.scene_number,
                                )
                                scene_videos[f"shot_{shot.shot_number}"] = shot_videos
                                logger.info(
                                    f"Successfully generated videos for shot {shot.shot_number}"
                                )
                            except Exception as e:
                                logger.error(
                                    f"Error generating video for chapter {chapter.chapter_number}, "
                                    f"scene {scene.scene_number}, shot {shot.shot_number}: {str(e)}"
                                )
                                continue

                    chapter_videos[f"scene_{scene.scene_number}"] = scene_videos
            video_results[f"chapter_{chapter.chapter_number}"] = chapter_videos

        logger.info("Completed video generation for entire script")
        return video_results
