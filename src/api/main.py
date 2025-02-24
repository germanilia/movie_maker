import logging
from pathlib import Path
import sys
from typing import List

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
from src.services.face_detection_service import FaceDetectionService

import os
from pydantic import BaseModel
import base64
import cv2
import json
from fastapi.responses import Response
import time
from starlette.responses import FileResponse as StarletteFileResponse

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

# Get the workspace root directory
workspace_root = Path(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
logger.info(f"Workspace root: {workspace_root}")

# Mount the temp directory for serving files
temp_dir = workspace_root / "temp"
logger.info(f"Temp directory: {temp_dir}")

if not temp_dir.exists():
    logger.warning(f"Creating temp directory: {temp_dir}")
    temp_dir.mkdir(parents=True)


# Mount static directories
app.mount("/temp", StaticFiles(directory=str(temp_dir)), name="temp")

# Mount the static frontend files
frontend_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "src",
    "frontend",
    "build",
)
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


class ProjectList(BaseModel):
    projects: List[str]

def get_workspace_root() -> Path:
    """Get the workspace root directory."""
    current_file = Path(__file__)
    # Navigate up from src/backend/app/api to the workspace root
    return current_file.parents[2]

@app.get("/list-projects", response_model=ProjectList)
async def list_projects():
    """List all projects in the temp directory"""
    try:
        # Get the workspace root and temp directory
        workspace_root = get_workspace_root()
        temp_dir = workspace_root / "temp"
        
        logger.info(f"Looking for projects in directory: {temp_dir}")
        
        if not temp_dir.exists():
            logger.warning(f"Temp directory does not exist, creating it: {temp_dir}")
            temp_dir.mkdir(parents=True)
        
        # Get all directories in temp folder
        projects = [
            d.name for d in temp_dir.iterdir() 
            if d.is_dir() and not d.name.startswith('.')
        ]
        
        logger.info(f"Found projects: {projects}")
        return {"projects": sorted(projects)}
    except Exception as e:
        logger.error(f"Error listing projects: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
        director = DirectorService(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        script = await director.get_script()
        
        # Get the indices
        chapter_idx = update_data["chapter_index"] - 1
        scene_idx = update_data["scene_index"] - 1
        shot_idx = update_data["shot_index"] - 1
        
        # Update the appropriate field based on the action
        if update_data["action"] == "director_instructions":
            script.chapters[chapter_idx].scenes[scene_idx].shots[shot_idx].director_instructions = update_data["description"]
        elif update_data["action"] == "opening":
            script.chapters[chapter_idx].scenes[scene_idx].shots[shot_idx].opening_frame = update_data["description"]
       
        
        # Save the updated script
        await director.save_script(script)
        return script

    except IndexError:
        raise HTTPException(status_code=400, detail="Invalid chapter, scene, or shot index")
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

        # Ensure correct image path with .png extension
        image_path = f"chapter_{request.chapter_index}/scene_{request.scene_index}/shot_{request.shot_index}_{request.type}.png"
        
        # Generate image
        success, local_path = await image_service.generate_image(
            prompt=request.custom_prompt or "",
            image_path=image_path,
            overwrite_image=request.overwrite_image,
            model_type=request.model_type,
            reference_image=request.reference_image,
            seed=request.seed
        )

        if not success or not local_path:
            return {"status": "error", "message": "Failed to generate image"}

        # Get base64 data with proper prefix
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
    shot_number: int | None = None
    voice_id: str | None = None

class CustomFileResponse(StarletteFileResponse):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add headers to prevent caching
        self.headers.update({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        })
        
def get_audio_file_response(file_path: str | Path, media_type: str = "audio/wav") -> CustomFileResponse:
    """Helper function to create audio file responses with proper cache headers"""
    if isinstance(file_path, str):
        file_path = Path(file_path)
        
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file not found: {file_path}")
        
    # Generate ETag based on file modification time
    mtime = file_path.stat().st_mtime
    etag = f'"{hash(mtime)}"'
    
    return CustomFileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=file_path.name,
        headers={
            "ETag": etag,
            "Last-Modified": time.strftime('%a, %d %b %Y %H:%M:%S GMT', time.gmtime(mtime))
        }
    )

@app.post("/api/generate-narration/{project_name}")
async def generate_narration(project_name: str, request: NarrationRequest):
    """Generate audio narration for given text"""
    try:
        aws_service = AWSService(project_name=project_name)
        voice_service = VoiceService()
        
        # Get or create cloned voice using the voice sample
        voice_sample_path = f"temp/{project_name}/voice_sample.m4a"
        if os.path.exists(voice_sample_path):
            try:
                voice_id = voice_service.get_or_create_cloned_voice(
                    voice_sample_path=voice_sample_path,
                    voice_name=f"{project_name}"
                )
            except Exception as e:
                logger.error(f"Error creating cloned voice: {str(e)}")
                voice_id = None
        else:
            voice_id = None
        
        # Generate a unique filename for this narration
        audio_path = f"chapter_{request.chapter_number}/scene_{request.scene_number}/narration.wav"
        local_path = aws_service.temp_dir / audio_path

        # Create directory if it doesn't exist
        local_path.parent.mkdir(parents=True, exist_ok=True)

        # Generate the audio using the cloned voice if available
        audio_chunks = await voice_service.generate_voice(
            text=request.text,
            voice_id=voice_id or request.voice_id
        )

        # Write chunks to file
        with open(local_path, "wb") as audio_file:
            for chunk in audio_chunks:
                audio_file.write(chunk)

        return get_audio_file_response(local_path)

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
            if not script or not script.chapters:
                raise HTTPException(status_code=404, detail="Script or chapters not found")
                
            scenes = script.chapters[request.chapter_number - 1].scenes or []
            if request.scene_number > len(scenes):
                raise HTTPException(status_code=400, detail="Invalid scene number")
                
            scene = scenes[request.scene_number - 1]
            request.prompt = f"Create background music that matches the mood of: {scene.background_music}"

        # Generate the music
        success, local_path = await music_service.generate_music(
            prompt=request.prompt,
            music_path=music_path,
            overwrite=request.overwrite
        )

        if not success or not local_path:
            raise Exception("Failed to generate background music")

        return get_audio_file_response(local_path, media_type="audio/mp3")

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
    chapter_number: int
    scene_number: int
    shot_number: int
    overwrite: bool = False
    provider: str = 'runwayml'

@app.post("/api/generate-shot-video/{project_name}")
async def generate_shot_video(project_name: str, request: VideoGenerationRequest) -> FileResponse:
    """Generate video for a specific shot"""
    try:
        aws_service = AWSService(project_name=project_name)
        video_service = VideoServiceFactory.create_video_service(VideoProvider(request.provider.lower()), aws_service)
        director = DirectorService(aws_service=aws_service, project_name=project_name)
        script = await director.get_script()
        if not script or not script.chapters:
            raise HTTPException(status_code=404, detail="Script or chapters not found")
        scenes = script.chapters[request.chapter_number - 1].scenes or []
        if request.scene_number > len(scenes):
            raise HTTPException(status_code=400, detail="Invalid scene number")
        
        scene = scenes[request.scene_number - 1]
        if not scene.shots:
            raise HTTPException(status_code=400, detail="No shots found in scene")
            
        if request.shot_number > len(scene.shots):
            raise HTTPException(status_code=400, detail="Invalid shot number")
            
        shot = scene.shots[request.shot_number - 1]
        if not shot:
            raise HTTPException(status_code=400, detail="Shot not found")
            
        prompt = shot.director_instructions
        if not prompt:
            raise HTTPException(status_code=400, detail="No director instructions found for shot")
            
        try:
            # Generate video
            success, video_path = await video_service.generate_video(
                chapter=str(request.chapter_number),
                scene=str(request.scene_number),
                shot=str(request.shot_number),
                overwrite=request.overwrite,
                prompt=prompt
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
async def get_all_videos(project_name: str) -> dict:
    """Get all generated videos for a project"""
    try:
        aws_service = AWSService(project_name=project_name)
        video_service = VideoServiceFactory.create_video_service(VideoProvider.REPLICATE, aws_service)

        videos = video_service.get_all_videos()
        
        # Add final scene videos
        temp_dir = Path("temp") / project_name
        if temp_dir.exists():
            for chapter_dir in temp_dir.glob("chapter_*"):
                chapter_num = int(chapter_dir.name.split("_")[1])
                for scene_dir in chapter_dir.glob("scene_*"):
                    scene_num = int(scene_dir.name.split("_")[1])
                    final_scene_path = scene_dir / "final_scene.mp4"
                    
                    if final_scene_path.exists():
                        with open(final_scene_path, "rb") as f:
                            video_data = base64.b64encode(f.read()).decode("utf-8")
                            videos[f"final_scene_{chapter_num}_{scene_num}"] = video_data

        return {
            "status": "success",
            "videos": videos
        }

    except Exception as e:
        logger.error(f"Error getting all videos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class SceneVideoRequest(BaseModel):
    chapter_number: int
    scene_number: int
    provider: VideoProvider = VideoProvider.REPLICATE
    black_and_white: bool = True

@app.post("/api/generate-scene-video/{project_name}")
async def generate_scene_video(project_name: str, request: SceneVideoRequest):
    """Generate a final video for a scene by combining all shots with narration and background music"""
    try:
        aws_service = AWSService(project_name=project_name)
        video_service = VideoServiceFactory.create_video_service(VideoProvider.REPLICATE, aws_service)
        
        success, output_path = await video_service.generate_scene_video(
            chapter=str(request.chapter_number),
            scene=str(request.scene_number),
            black_and_white=request.black_and_white
        )

        if not success or not output_path:
            raise HTTPException(status_code=500, detail="Failed to generate scene video")

        return FileResponse(
            path=output_path,
            media_type="video/mp4",
            filename=f"scene_{request.chapter_number}_{request.scene_number}_final.mp4"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating scene video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/detect-faces/{project_name}")
async def detect_faces(project_name: str, chapter_index: int, scene_index: int, shot_index: int, type: str):
    """Detect faces in an image"""
    try:
        aws_service = AWSService(project_name=project_name)
        director = DirectorService(aws_service=aws_service, project_name=project_name)
        script = await director.get_script()
        image_service = ImageService(
            aws_service=aws_service,
            black_and_white=script.project_details.black_and_white,
        )

        # Get image path
        image_path = f"chapter_{chapter_index}/scene_{scene_index}/shot_{shot_index}_{type}.png"
        local_path = image_service.get_local_path(image_path)

        if not local_path.exists():
            raise HTTPException(status_code=404, detail="Image not found")

        # Detect faces
        face_service = FaceDetectionService(aws_service=aws_service, image_service=image_service)
        result = await face_service.detect_faces_multiple([str(local_path)])

        return {
            "status": "success",
            "face_detection_result": result,
            "image_path": str(local_path)
        }

    except Exception as e:
        logger.error(f"Error detecting faces: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class FaceSwapRequest(BaseModel):
    source_image: str  # Base64 encoded image
    target_chapter_index: int
    target_scene_index: int
    target_shot_index: int
    target_type: str

@app.post("/api/swap-faces/{project_name}")
async def swap_faces(project_name: str, request: FaceSwapRequest):
    """Swap faces between source and target images"""
    try:
        aws_service = AWSService(project_name=project_name)
        image_service = ImageService(aws_service=aws_service)
        face_service = FaceDetectionService(aws_service=aws_service, image_service=image_service)

        # Create temp directory if it doesn't exist
        temp_dir = Path("temp") / project_name / "face_swap"
        temp_dir.mkdir(parents=True, exist_ok=True)

        # Save source image from base64
        source_path = temp_dir / "source_image.png"
        source_data = base64.b64decode(request.source_image.split(',')[1])
        with open(source_path, "wb") as f:
            f.write(source_data)

        # Get target image path
        target_path = (
            f"chapter_{request.target_chapter_index}/"
            f"scene_{request.target_scene_index}/"
            f"shot_{request.target_shot_index}_{request.target_type}.png"
        )
        target_local_path = image_service.get_local_path(target_path)

        if not target_local_path.exists():
            raise HTTPException(status_code=404, detail="Target image not found")

        try:
            # Perform face swapping
            result_base64 = await face_service.swap_faces(
                source_image_path=str(source_path),
                target_image_path=str(target_local_path)
            )

            # Save the result
            result_data = base64.b64decode(result_base64)
            with open(target_local_path, "wb") as f:
                f.write(result_data)

            return {
                "status": "success",
                "base64_image": f"data:image/png;base64,{result_base64}"
            }

        finally:
            # Clean up temp files
            if source_path.exists():
                source_path.unlink()
            if temp_dir.exists():
                temp_dir.rmdir()

    except Exception as e:
        logger.error(f"Error swapping faces: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class SwapInstruction(BaseModel):
    target_idx: int
    source_img_name: str
    source_idx: int

class CustomFaceSwapRequest(BaseModel):
    source_images: List[str]  # List of base64 encoded images
    swap_instructions: List[SwapInstruction]

@app.post("/api/swap-faces-custom/{project_name}")
async def swap_faces_custom(
    project_name: str, 
    chapter_index: int,
    scene_index: int, 
    shot_index: int, 
    type: str,
    request: CustomFaceSwapRequest
):
    """Swap multiple faces based on custom mapping"""
    try:
        aws_service = AWSService(project_name=project_name)
        image_service = ImageService(aws_service=aws_service)
        face_service = FaceDetectionService(aws_service=aws_service, image_service=image_service)

        # Get target image path
        target_path = f"chapter_{chapter_index}/scene_{scene_index}/shot_{shot_index}_{type}.png"
        target_local_path = image_service.get_local_path(target_path)

        if not target_local_path.exists():
            raise HTTPException(status_code=404, detail="Target image not found")

        # Create temp directory for source images
        temp_dir = aws_service.temp_dir / "face_swap_temp"
        temp_dir.mkdir(parents=True, exist_ok=True)

        source_images_info = []
        try:
            # Save source images from base64
            for idx, base64_img in enumerate(request.source_images):
                img_data = base64.b64decode(base64_img.split(',')[1])
                temp_path = temp_dir / f"source_{idx}.png"
                with open(temp_path, "wb") as f:
                    f.write(img_data)
                source_images_info.append({
                    'path': str(temp_path),
                    'name': f"source_{idx}.png"
                })

            # Perform face swapping
            result_base64 = await face_service.swap_faces_custom(
                target_image_path=str(target_local_path),
                source_images=source_images_info,
                swap_instructions=[instruction.model_dump() for instruction in request.swap_instructions]
            )

            if not result_base64:
                raise ValueError("No result image received from face swapping service")

            # Save the result back to the target path
            result_data = base64.b64decode(result_base64)
            logger.info(f"Writing swapped image to {target_local_path}")
            
            if not result_data:
                raise ValueError("Empty result data from face swapping")
                
            with open(target_local_path, "wb") as f:
                f.write(result_data)
            
            if not target_local_path.exists():
                raise ValueError(f"Failed to write file to {target_local_path}")
                
            # Verify file size
            file_size = target_local_path.stat().st_size
            logger.info(f"Written file size: {file_size} bytes")
            if file_size == 0:
                raise ValueError("Written file is empty")

            # Verify image can be read
            result_img = cv2.imread(str(target_local_path))
            if result_img is None:
                raise ValueError("Failed to read written image")

            # Read back and encode the final result
            with open(target_local_path, "rb") as f:
                final_base64 = base64.b64encode(f.read()).decode("utf-8")

            return {
                "status": "success",
                "base64_image": f"data:image/png;base64,{final_base64}"
            }

        finally:
            # Clean up temp files
            for source in source_images_info:
                try:
                    Path(source['path']).unlink()
                except Exception as e:
                    logger.warning(f"Failed to delete temp file {source['path']}: {e}")
            try:
                temp_dir.rmdir()
            except Exception as e:
                logger.warning(f"Failed to delete temp directory {temp_dir}: {e}")

    except Exception as e:
        logger.error(f"Error in custom face swapping: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class RegenerateSceneRequest(BaseModel):
    chapter_index: int
    scene_index: int
    instructions: str | None = None  # Optional instructions for scene regeneration

class RegenerateShotRequest(BaseModel):
    chapter_index: int
    scene_index: int
    shot_index: int
    instructions: str | None = None  # Optional instructions for shot regeneration

@app.post("/api/regenerate-shot/{project_name}")
async def regenerate_shot(
    project_name: str,
    request: RegenerateShotRequest
) -> Script:
    """Regenerate a specific shot in the script"""
    try:
        director = DirectorService(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        script = await director.get_script()
        
        if not script or not script.chapters:
            raise HTTPException(status_code=404, detail="Script or chapters not found")
            
        # Convert 1-based indices to 0-based
        chapter_idx = request.chapter_index - 1
        scene_idx = request.scene_index - 1
        shot_idx = request.shot_index - 1
            
        if chapter_idx >= len(script.chapters) or chapter_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid chapter index")
            
        if not script.chapters[chapter_idx].scenes or scene_idx >= len(script.chapters[chapter_idx].scenes or []) or scene_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid scene index")
            
        chapter = script.chapters[chapter_idx]
        if not chapter.scenes or not chapter.scenes[scene_idx].shots or shot_idx >= len(chapter.scenes[scene_idx].shots or []) or shot_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid shot index")
        
        try:
            # Regenerate the shot with custom instructions if provided
            script = await director.regenerate_shot(
                script=script,
                chapter_index=chapter_idx,
                scene_index=scene_idx,
                shot_index=shot_idx,
                custom_instructions=request.instructions
            )
            
            await director.save_script(script)
            
            return script
            
        except ValueError as ve:
            raise HTTPException(status_code=500, detail=str(ve))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate shot: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred while regenerating the shot: {str(e)}"
        )

@app.post("/api/regenerate-scene/{project_name}")
async def regenerate_scene(
    project_name: str,
    request: RegenerateSceneRequest
) -> Script:
    """Regenerate a specific scene in the script"""
    try:
        director = DirectorService(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        script = await director.get_script()
        
        if not script or not script.chapters:
            raise HTTPException(status_code=404, detail="Script or chapters not found")
            
        # Convert 1-based indices to 0-based
        chapter_idx = request.chapter_index - 1
        scene_idx = request.scene_index - 1
            
        if chapter_idx >= len(script.chapters) or chapter_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid chapter index")
            
        if not script.chapters[chapter_idx].scenes or scene_idx >= len(script.chapters[chapter_idx].scenes or []) or scene_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid scene index")
        
        try:
            # Regenerate the scene with custom instructions if provided
            script = await director.regenerate_scene(
                script=script,
                chapter_index=chapter_idx,
                scene_index=scene_idx,
                custom_instructions=request.instructions
            )
            
            await director.save_script(script)
            
            return script
            
        except ValueError as ve:
            # Convert ValueError to HTTPException with the error message
            raise HTTPException(status_code=500, detail=str(ve))
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate scene: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred while regenerating the scene: {str(e)}"
        )

@app.get("/api/get-scene-video/{project_name}/{chapter_number}/{scene_number}")
async def get_scene_video(
    project_name: str,
    chapter_number: int,
    scene_number: int
):
    """Get the final scene video if it exists"""
    try:
        video_path = Path("temp") / project_name / f"chapter_{chapter_number}" / f"scene_{scene_number}" / "final_scene.mp4"
        
        if not video_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Video not found for chapter {chapter_number}, scene {scene_number}"
            )

        return CustomFileResponse(
            path=str(video_path),
            media_type="video/mp4",
            filename=f"final_scene_{chapter_number}_{scene_number}.mp4",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
                "ETag": f'"{hash(video_path.stat().st_mtime)}"',
                "Last-Modified": time.strftime('%a, %d %b %Y %H:%M:%S GMT', time.gmtime(video_path.stat().st_mtime))
            }
        )

    except Exception as e:
        logger.error(f"Error getting scene video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class RegenerateChapterRequest(BaseModel):
    chapter_index: int
    instructions: str | None = None  # Optional instructions for chapter regeneration

@app.post("/api/regenerate-chapter/{project_name}")
async def regenerate_chapter(
    project_name: str,
    request: RegenerateChapterRequest
) -> Script:
    """Regenerate a specific chapter in the script"""
    try:
        director = DirectorService(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        script = await director.get_script()
        
        if not script or not script.chapters:
            raise HTTPException(status_code=404, detail="Script or chapters not found")
            
        # Convert 1-based index to 0-based
        chapter_idx = request.chapter_index - 1
            
        if chapter_idx >= len(script.chapters) or chapter_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid chapter index")
        
        # Regenerate the chapter with custom instructions if provided
        script = await director.regenerate_chapter(
            script=script,
            chapter_index=chapter_idx,
            custom_instructions=request.instructions
        )
        
        scenes = await director.generate_scenes(script.project_details,script.chapters, script.chapters[chapter_idx])
        script.chapters[chapter_idx].scenes = scenes
        for scene in scenes:
            ### TODO: This is a workaround due to indexing issue, sometimes the indexes start with 0 and sometimes with 1
            ### TODO: Need to fix this properly
            script = await director.generate_shots(script, specific_scene_index=scene.scene_number-1, specific_chapter_index=chapter_idx)
            await director.save_script(script)
        return script
        
    except Exception as e:
        logger.error(f"Failed to regenerate chapter: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class RegenerateNarrationRequest(BaseModel):
    chapter_number: int
    scene_number: int
    instructions: str | None = None

class UpdateNarrationRequest(BaseModel):
    chapter_number: int
    scene_number: int
    narration_text: str

@app.post("/api/regenerate-narration/{project_name}")
async def regenerate_narration(project_name: str, request: RegenerateNarrationRequest):
    """Regenerate narration for a specific scene using LLM"""
    try:
        aws_service = AWSService(project_name=project_name)
        director = DirectorService(aws_service=aws_service, project_name=project_name)
        script = await director.get_script()
        
        # Convert 1-based indices to 0-based
        chapter_idx = request.chapter_number - 1
        scene_idx = request.scene_number - 1
        
        if not script or not script.chapters:
            raise HTTPException(status_code=404, detail="Script or chapters not found")
            
        if chapter_idx >= len(script.chapters) or chapter_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid chapter index")
            
        chapter = script.chapters[chapter_idx]
        if not chapter.scenes or scene_idx >= len(chapter.scenes) or scene_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid scene index")

        # Load and format the regenerate narration prompt
        prompt_template = await director._load_prompt("regenerate_narration_prompt.txt")
        prompt = await director._format_prompt(
            prompt_template,
            script=script,
            regenerate_narration_instructions=request.instructions or "N/A"
        )

        # Get LLM response
        response = await aws_service.invoke_llm(prompt)
        
        try:
            narration_data = json.loads(response)
            if not isinstance(narration_data, dict):
                raise ValueError("Response is not a valid JSON object")

            # Update the script with new narration
            chapter.scenes[scene_idx].narration_text = narration_data["narration"]
            await director.save_script(script)

            # Generate audio using voice service
            voice_service = VoiceService()
            success, result = await voice_service.regenerate_narration(
                text=narration_data["narration"],
                project_name=project_name,
                chapter_number=request.chapter_number,
                scene_number=request.scene_number,
                temp_dir=aws_service.temp_dir
            )

            if not success:
                raise ValueError(f"Failed to generate audio: {result}")

            return {
                "status": "success",
                "narration": narration_data["narration"],
                "reasoning": narration_data["reasoning"]
            }

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}\nResponse: {response}")
            raise ValueError(f"Invalid JSON response: {str(e)}")
        except Exception as e:
            logger.error(f"Error processing narration data: {str(e)}")
            raise ValueError(f"Failed to process narration data: {str(e)}")

    except Exception as e:
        logger.error(f"Error regenerating narration: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/update-narration/{project_name}")
async def update_narration(project_name: str, request: UpdateNarrationRequest):
    """Update narration text and regenerate audio"""
    try:
        aws_service = AWSService(project_name=project_name)
        director = DirectorService(aws_service=aws_service, project_name=project_name)
        script = await director.get_script()
        
        # Convert 1-based indices to 0-based
        chapter_idx = request.chapter_number - 1
        scene_idx = request.scene_number - 1
        
        if not script or not script.chapters:
            raise HTTPException(status_code=404, detail="Script or chapters not found")
            
        if chapter_idx >= len(script.chapters) or chapter_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid chapter index")
            
        chapter = script.chapters[chapter_idx]
        if not chapter.scenes or scene_idx >= len(chapter.scenes) or scene_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid scene index")

        # Update script with new narration text
        chapter.scenes[scene_idx].narration_text = request.narration_text
        await director.save_script(script)

        # Generate new audio using voice service
        voice_service = VoiceService()
        success, result = await voice_service.update_narration(
            text=request.narration_text,
            project_name=project_name,
            chapter_number=request.chapter_number,
            scene_number=request.scene_number,
            temp_dir=aws_service.temp_dir
        )

        if not success:
            raise ValueError(f"Failed to generate audio: {result}")

        return {
            "status": "success",
            "narration": request.narration_text
        }

    except Exception as e:
        logger.error(f"Error updating narration: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))