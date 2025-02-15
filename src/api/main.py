import logging
from pathlib import Path
import sys

from src.services.director_service import DirectorService
from src.services.image_service import ImageService
from src.services.voice_service import VoiceService
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from src.models.models import ProjectDetails, Script, RegenerateImageRequest
from src.services.aws_service import AWSService
from src.services.background_music_service import BackgroundMusicService
from src.services.video_service_factory import VideoServiceFactory, VideoProvider

import os
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Reduce boto3/botocore logging noise
logging.getLogger("botocore").setLevel(logging.WARNING)
logging.getLogger("boto3").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# Get the logger for this module
logger = logging.getLogger(__name__)


app = FastAPI(title="Video Creator API")
# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static frontend files
frontend_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "src",
    "frontend",
    "build",
)
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


@app.post("/api/generate-script")
async def generate_script(project_details: ProjectDetails):
    """Generate a new script based on project details"""
    try:
        director = DirectorService(
            aws_service=AWSService(project_name=project_details.project),
            project_name=project_details.project,
        )
        # Convert ProjectDetails to ProjectDetails
        video_request = ProjectDetails(**project_details.model_dump())
        script = await director.create_script(video_request)
        return {"message": "Script generated successfully", "script": script}
    except Exception as e:
        logger.error(f"Failed to generate script: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate_shots/{project_name}")
async def generate_shots(project_name: str, script: Script) -> Script:
    """Generate shots for a specific scene with retry mechanism."""
    try:
        director = DirectorService(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        script = await director.generate_shots(script)
        return script
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/update-shot-description/{project_name}")
async def update_shot_description(project_name: str, update_data: dict):
    try:
        # Load the current script
        director = DirectorService(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )

        script = await director.get_script()
        if update_data["action"] == "opening":
            script.chapters[update_data["chapter_index"] - 1].scenes[
                update_data["scene_index"] - 1
            ].shots[
                update_data["shot_index"] - 1
            ].opening_frame = update_data[
                "description"
            ]
        else:
            script.chapters[update_data["chapter_index"] - 1].scenes[
                update_data["scene_index"] - 1
            ].shots[
                update_data["shot_index"] - 1
            ].closing_frame = update_data[
                "description"
            ]
        temp = (
            script.chapters[update_data["chapter_index"] - 1]
            .scenes[update_data["scene_index"] - 1]
            .shots[update_data["shot_index"] - 1]
            .opening_frame
        )
        print(temp)
        await director.save_script(script)
        temp = (
            script.chapters[update_data["chapter_index"] - 1]
            .scenes[update_data["scene_index"] - 1]
            .shots[update_data["shot_index"] - 1]
            .opening_frame
        )
        return script  # Return the entire updated script instead of just status
    except IndexError:
        raise HTTPException(
            status_code=400, detail="Invalid chapter, scene, or shot index"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/update-script/{project_name}")
async def update_script(project_name: str, script: Script) -> Script:
    """Update an existing script"""
    try:
        director = DirectorService(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        await director.save_script(script)
        return script
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/script/{project_name}")
async def get_script(project_name: str) -> Script:
    """Get the current script for a project"""
    try:
        director = DirectorService(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        return await director.get_script()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-image/{project_name}")
async def get_image(
    project_name: str, chapter_index: int, scene_index: int, shot_index: int, type: str
):
    """Get a specific image if it exists and return it as base64"""
    try:
        aws_service = AWSService(project_name=project_name)
        director = DirectorService(aws_service=aws_service, project_name=project_name)
        script = await director.get_script()
        
        image_service = ImageService(
            aws_service=aws_service,
            black_and_white=script.project_details.black_and_white,
        )

        image_path = (
            f"chapter_{chapter_index}/scene_{scene_index}/shot_{shot_index}_{type}.png"
        )

        # Check if image exists
        image_exists = image_service.ensure_image_exists(image_path)

        if not image_exists:
            return {
                "status": "not_found",
                "message": "Image not found",
                "chapter_index": chapter_index,
                "scene_index": scene_index,
                "shot_index": shot_index,
                "type": type,
                "path": image_path,
            }

        # Get the image as base64
        local_path = image_service.temp_dir / image_path
        base64_image = image_service.encode_image_to_base64(local_path)

        return {
            "status": "success",
            "base64_image": base64_image,
            "chapter_index": chapter_index,
            "scene_index": scene_index,
            "shot_index": shot_index,
            "type": type,
            "path": image_path,
        }
    except FileNotFoundError:
        return {
            "status": "not_found",
            "message": f"Image file not found at path {image_path}",
            "chapter_index": chapter_index,
            "scene_index": scene_index,
            "shot_index": shot_index,
            "type": type,
            "path": image_path,
        }
    except Exception as e:
        logger.error(f"Error getting image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/regenerate-image/{project_name}")
async def regenerate_image(
    project_name: str,
    request: RegenerateImageRequest,
):
    """Regenerate a specific image with optional custom prompt"""
    try:
        aws_service = AWSService(project_name=project_name)
        director = DirectorService(aws_service=aws_service, project_name=project_name)
        script = await director.get_script()
        image_service = ImageService(
            aws_service=aws_service,
            black_and_white=script.project_details.black_and_white,
        )

        image_path = f"chapter_{request.chapter_index}/scene_{request.scene_index}/shot_{request.shot_index}_{request.type}.png"
        
        # Generate image and get base64 data
        success, local_path = await image_service.generate_image(
            prompt=request.custom_prompt,
            image_path=image_path,
            overwrite_image=request.overwrite_image,
        )

        if not success or not local_path:
            return {"status": "error", "message": "Failed to generate image"}

        base64_image = image_service.encode_image_to_base64(local_path)

        return {
            "status": "success",
            "message": "Image regeneration completed",
            "base64_image": base64_image,
            "chapter_index": request.chapter_index,
            "scene_index": request.scene_index,
            "shot_index": request.shot_index,
            "type": request.type,
            "path": image_path,
        }
    except Exception as e:
        logger.error(f"Error regenerating image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-all-images/{project_name}")
async def get_all_images(project_name: str):
    """Get all generated images for a project and return them as base64"""
    try:
        aws_service = AWSService(project_name=project_name)
        director = DirectorService(aws_service=aws_service, project_name=project_name)
        script = await director.get_script()
        image_service = ImageService(
            aws_service=aws_service,
            black_and_white=script.project_details.black_and_white,
        )

        # Get all image files in the project directory
        project_dir = image_service.temp_dir
        image_data = {}

        if project_dir.exists():
            for chapter_dir in project_dir.glob("chapter_*"):
                chapter_num = int(chapter_dir.name.split("_")[1])
                for scene_dir in chapter_dir.glob("scene_*"):
                    scene_num = int(scene_dir.name.split("_")[1])
                    for image_file in scene_dir.glob("shot_*.png"):
                        # Parse shot number and type from filename
                        filename_parts = image_file.stem.split("_")
                        shot_num = int(filename_parts[1])
                        shot_type = filename_parts[2]  # 'opening' or 'closing'

                        image_key = f"{chapter_num}-{scene_num}-{shot_num}-{shot_type}"
                        image_data[image_key] = image_service.encode_image_to_base64(image_file)

        return {"status": "success", "images": image_data}
    except Exception as e:
        logger.error(f"Error getting all images: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class NarrationRequest(BaseModel):
    text: str
    chapter_number: int
    scene_number: int
    shot_number: int = None
    voice_id: str = None

@app.post("/api/generate-narration/{project_name}")
async def generate_narration(project_name: str, request: NarrationRequest):
    """Generate audio narration for given text"""
    try:
        aws_service = AWSService(project_name=project_name)
        voice_service = VoiceService()
        
        # Generate a unique filename for this narration
        audio_path = f"chapter_{request.chapter_number}/scene_{request.scene_number}/narration.wav"
        local_path = aws_service.temp_dir / audio_path

        # Create directory if it doesn't exist
        local_path.parent.mkdir(parents=True, exist_ok=True)

        # Generate the audio
        audio_chunks = await voice_service.generate_voice(
            text=request.text,
            voice_id=request.voice_id
        )

        # Write chunks to file
        with open(local_path, "wb") as audio_file:
            for chunk in audio_chunks:
                audio_file.write(chunk)

        # Return the audio file
        return FileResponse(
            path=str(local_path),
            media_type="audio/wav",
            filename="narration.wav"
        )

    except Exception as e:
        logger.error(f"Error generating narration: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-all-narrations/{project_name}")
async def get_all_narrations(project_name: str):
    """Get all existing narration audio files for a project"""
    try:
        aws_service = AWSService(project_name=project_name)
        project_dir = aws_service.temp_dir
        narration_files = {}

        if project_dir.exists():
            for chapter_dir in project_dir.glob("chapter_*"):
                chapter_num = int(chapter_dir.name.split("_")[1])
                for scene_dir in chapter_dir.glob("scene_*"):
                    scene_num = int(scene_dir.name.split("_")[1])
                    narration_path = scene_dir / "narration.wav"

                    if narration_path.exists():
                        key = f"{chapter_num}-{scene_num}"
                        # Read the audio file and convert to base64
                        with open(narration_path, "rb") as f:
                            import base64
                            audio_data = base64.b64encode(f.read()).decode("utf-8")
                            narration_files[key] = audio_data

        return {"status": "success", "narrations": narration_files}

    except Exception as e:
        logger.error(f"Error getting all narrations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class BackgroundMusicRequest(BaseModel):
    chapter_number: int
    scene_number: int
    prompt: str | None = None
    overwrite: bool = False

@app.post("/api/generate-background-music/{project_name}")
async def generate_background_music(project_name: str, request: BackgroundMusicRequest):
    """Generate background music for a specific scene"""
    try:
        aws_service = AWSService(project_name=project_name)
        music_service = BackgroundMusicService(aws_service=aws_service)

        # Generate a unique filename for this background music
        music_path = f"chapter_{request.chapter_number}/scene_{request.scene_number}/background_music.mp3"

        # Create default prompt if none provided
        if not request.prompt:
            director = DirectorService(aws_service=aws_service, project_name=project_name)
            script = await director.get_script()
            scene = script.chapters[request.chapter_number - 1].scenes[request.scene_number - 1]
            request.prompt = f"Create background music that matches the mood of: {scene.background_music}"

        # Generate the music
        success, local_path = await music_service.generate_music(
            prompt=request.prompt,
            music_path=music_path,
            overwrite=request.overwrite
        )

        if not success or not local_path:
            raise Exception("Failed to generate background music")

        # Return the audio file
        return FileResponse(
            path=local_path,
            media_type="audio/mp3",
            filename="background_music.mp3"
        )
    except Exception as e:
        logger.error(f"Error generating background music: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-all-background-music/{project_name}")
async def get_all_background_music(project_name: str):
    """Get all existing background music files for a project"""
    try:
        aws_service = AWSService(project_name=project_name)
        music_service = BackgroundMusicService(aws_service=aws_service)
        project_dir = Path(music_service.temp_dir)
        music_files = {}

        if project_dir.exists():
            for chapter_dir in project_dir.glob("chapter_*"):
                chapter_num = int(chapter_dir.name.split("_")[1])
                for scene_dir in chapter_dir.glob("scene_*"):
                    scene_num = int(scene_dir.name.split("_")[1])
                    music_path = scene_dir / "background_music.mp3"

                    if music_path.exists():
                        key = f"{chapter_num}-{scene_num}"
                        # Read the audio file and convert to base64
                        with open(music_path, "rb") as f:
                            import base64
                            audio_data = base64.b64encode(f.read()).decode("utf-8")
                            music_files[key] = audio_data

        return {"status": "success", "background_music": music_files}
    except Exception as e:
        logger.error(f"Error getting all background music: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class VideoGenerationRequest(BaseModel):
    prompt: str
    chapter_number: int
    scene_number: int
    shot_number: int
    overwrite: bool = False
    provider: VideoProvider = VideoProvider.REPLICATE  # Default to Replicate
    frame_mode: str = "both"  # Default to using both frames

@app.post("/api/generate-shot-video/{project_name}")
async def generate_shot_video(project_name: str, request: VideoGenerationRequest):
    """Generate video for a specific shot"""
    try:
        aws_service = AWSService(project_name=project_name)
        video_service = VideoServiceFactory.create_video_service(request.provider, aws_service)

        try:
            # Generate video
            success, video_path = await video_service.generate_video(
                prompt=request.prompt,
                chapter=str(request.chapter_number),
                scene=str(request.scene_number),
                shot=str(request.shot_number),
                overwrite=request.overwrite,
                frame_mode=request.frame_mode
            )

            if not success or not video_path:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate video - no video path returned"
                )

            return FileResponse(
                path=video_path,
                media_type="video/mp4",
                filename=f"video_{request.chapter_number}_{request.scene_number}_{request.shot_number}.mp4"
            )

        except Exception as service_error:
            # Log the detailed error and raise a user-friendly message
            logger.error(f"Video service error: {str(service_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Video generation failed: {str(service_error)}"
            )

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"Unexpected error generating video: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during video generation"
        )

@app.get("/api/get-video/{project_name}")
async def get_video(
    project_name: str,
    chapter_number: int,
    scene_number: int,
    shot_number: int,
    provider: VideoProvider = VideoProvider.REPLICATE
):
    """Get a specific video if it exists"""
    try:
        aws_service = AWSService(project_name=project_name)
        video_service = VideoServiceFactory.create_video_service(provider, aws_service)

        video_exists = video_service.video_exists(
            chapter=str(chapter_number),
            scene=str(scene_number),
            shot=str(shot_number)
        )

        if not video_exists:
            return {
                "status": "not_found",
                "message": "Video not found",
                "chapter": chapter_number,
                "scene": scene_number,
                "shot": shot_number
            }

        video_path = video_service.get_shot_path(
            chapter=str(chapter_number),
            scene=str(scene_number),
            shot=str(shot_number)
        )
        local_path = video_service.get_local_path(video_path)

        return FileResponse(
            path=str(local_path),
            media_type="video/mp4",
            filename=f"video_{chapter_number}_{scene_number}_{shot_number}.mp4"
        )

    except Exception as e:
        logger.error(f"Error getting video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-all-videos/{project_name}")
async def get_all_videos(project_name: str, provider: VideoProvider = VideoProvider.REPLICATE):
    """Get all generated videos for a project"""
    try:
        aws_service = AWSService(project_name=project_name)
        video_service = VideoServiceFactory.create_video_service(provider, aws_service)

        videos = video_service.get_all_videos()
        return {
            "status": "success",
            "videos": videos
        }

    except Exception as e:
        logger.error(f"Error getting all videos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
