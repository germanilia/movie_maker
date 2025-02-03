from operator import ge
from core.image_generator import ImageGenerator
from core.sound_generator import SoundGenerator
from core.video_genrator import VideoGenerator
from services.aws_service import AWSService
from core.director import Director
from dotenv import load_dotenv

import asyncio
from utils.request_loader import read_video_request
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Set to logging.DEBUG for even more detailed logs
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

load_dotenv()
# Example usage:
if __name__ == "__main__":
    import asyncio

    async def main():

        # Read the video request from the YAML file
        request = read_video_request("input/example_request.yaml")
        director = Director(
            aws_service=AWSService(project_name=request.project),
            project_name=request.project,
        )
        image_generator = ImageGenerator(
            aws_service=AWSService(project_name=request.project),
            black_and_white=request.black_and_white,
            genre=request.genre,
        )
        video_generator = VideoGenerator(
            aws_service=AWSService(project_name=request.project),
            project_name=request.project,
        )
        sound_generator = SoundGenerator(
            aws_service=AWSService(project_name=request.project),
            project_name=request.project,
        )

        script = await director.create_script(request)
        await image_generator.generate_images_for_script(script)
        await video_generator.generate_videos_for_script(script)
        await sound_generator.generate_audio_for_script(script)
        print(script)

    asyncio.run(main())
