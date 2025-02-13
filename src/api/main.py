import logging
import sys

from src.core.sound_generator import SoundGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Reduce boto3/botocore logging noise
logging.getLogger('botocore').setLevel(logging.WARNING)
logging.getLogger('boto3').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)

# Get the logger for this module
logger = logging.getLogger(__name__)

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from src.core.image_generator import ImageGenerator
from src.models.models import ProjectDetails, Script, RegenerateImageRequest
from src.core.director import Director
from src.core.video_genrator import VideoGenerator
from src.services.aws_service import AWSService
from src.models.image import ImageRequest, ImageResponse
# from src.services.image_generator import ImageGenerator
import os
from pydantic import BaseModel
import uuid

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
        director = Director(
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
        director = Director(
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
        director = Director(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )

        script = await director.get_script()
        if update_data["action"] == "opening":
            script.chapters[update_data["chapter_index"] - 1].scenes[
                update_data["scene_index"] - 1
            ].shots[
                update_data["shot_index"] - 1
            ].detailed_opening_scene_description = update_data[
                "description"
            ]
        else:
            script.chapters[update_data["chapter_index"] - 1].scenes[
                update_data["scene_index"] - 1
            ].shots[
                update_data["shot_index"] - 1
            ].detailed_closing_scene_description = update_data[
                "description"
            ]
        temp = (
            script.chapters[update_data["chapter_index"] - 1]
            .scenes[update_data["scene_index"] - 1]
            .shots[update_data["shot_index"] - 1]
            .detailed_opening_scene_description
        )
        print(temp)
        await director.save_script(script)
        temp = (
            script.chapters[update_data["chapter_index"] - 1]
            .scenes[update_data["scene_index"] - 1]
            .shots[update_data["shot_index"] - 1]
            .detailed_opening_scene_description
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
        director = Director(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        await director.save_script(script)
        return script
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-video/{project_name}")
async def generate_video(project_name: str, script: Script):
    """Generate the final video"""
    try:
        video_generator = VideoGenerator(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        await video_generator.generate_videos_for_script(script)
        return {"status": "success", "message": "Video generation started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/script/{project_name}")
async def get_script(project_name: str) -> Script:
    """Get the current script for a project"""
    try:
        director = Director(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        return await director.get_script()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-image/{project_name}")
async def get_image(
    project_name: str,
    chapter_index: int,
    scene_index: int,
    shot_index: int,
    type: str
):
    """Get a specific image if it exists and return it as base64"""
    try:
        aws_service = AWSService(project_name=project_name)
        image_generator = ImageGenerator(
            aws_service=aws_service,
            black_and_white=False  # Can be made configurable if needed
        )
        
        image_path = f"chapter_{chapter_index}/scene_{scene_index}/shot_{shot_index}_{type}.png"
        
        # Check if image exists and get its base64 data
        image_exists = await image_generator.ensure_image_exists(image_path)
        
        if not image_exists:
            # Instead of throwing a 404, return a response indicating the image doesn't exist
            return {
                "status": "not_found",
                "message": "Image not found",
                "chapter_index": chapter_index,
                "scene_index": scene_index,
                "shot_index": shot_index,
                "type": type,
                "path": image_path
            }
        
        # Get the image as base64
        local_path = image_generator.temp_dir / image_path
        with open(local_path, "rb") as image_file:
            import base64
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        
        return {
            "status": "success",
            "base64_image": base64_image,
            "chapter_index": chapter_index,
            "scene_index": scene_index,
            "shot_index": shot_index,
            "type": type,
            "path": image_path
        }
    except FileNotFoundError:
        return {
            "status": "not_found",
            "message": f"Image file not found at path {image_path}",
            "chapter_index": chapter_index,
            "scene_index": scene_index,
            "shot_index": shot_index,
            "type": type,
            "path": image_path
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
        image_generator = ImageGenerator(aws_service=aws_service)
        
        image_path = f"chapter_{request.chapter_index}/scene_{request.scene_index}/shot_{request.shot_index}_{request.type}.png"
        
        # Generate image and get base64 data
        base64_image = await image_generator.generate_image(
            prompt=request.custom_prompt,
            image_path=image_path,
            overwrite_image=True
        )
        
        return {
            "status": "success",
            "message": "Image regeneration completed",
            "base64_image": base64_image,
            "chapter_index": request.chapter_index,
            "scene_index": request.scene_index,
            "shot_index": request.shot_index,
            "type": request.type,
            "path": image_path
        }
    except Exception as e:
        logger.error(f"Error regenerating image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-all-images/{project_name}")
async def get_all_images(project_name: str):
    """Get all generated images for a project and return them as base64"""
    try:
        aws_service = AWSService(project_name=project_name)
        image_generator = ImageGenerator(
            aws_service=aws_service,
            black_and_white=False
        )
        
        # Get all image files in the project directory
        project_dir = image_generator.temp_dir
        image_data = {}
        
        if project_dir.exists():
            for chapter_dir in project_dir.glob("chapter_*"):
                chapter_num = int(chapter_dir.name.split("_")[1])
                for scene_dir in chapter_dir.glob("scene_*"):
                    scene_num = int(scene_dir.name.split("_")[1])
                    for image_file in scene_dir.glob("shot_*.png"):
                        # Parse shot number and type from filename
                        # Format: shot_1_opening.png or shot_1_closing.png
                        filename_parts = image_file.stem.split("_")
                        shot_num = int(filename_parts[1])
                        shot_type = filename_parts[2]  # 'opening' or 'closing'
                        
                        image_key = f"{chapter_num}-{scene_num}-{shot_num}-{shot_type}"
                        
                        # Read and encode image
                        with open(image_file, "rb") as f:
                            import base64
                            base64_image = base64.b64encode(f.read()).decode('utf-8')
                            image_data[image_key] = base64_image
        
        return {
            "status": "success",
            "images": image_data
        }
    except Exception as e:
        logger.error(f"Error getting all images: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class NarrationRequest(BaseModel):
    text: str
    chapter_number: int
    scene_number: int
    shot_number: int = None



@app.post("/api/generate-narration/{project_name}")
async def generate_narration(project_name: str, request: NarrationRequest):
    """Generate audio narration for given text"""
    try:
        aws_service = AWSService(project_name=project_name)
        sound_generator = SoundGenerator(
            aws_service=aws_service,
            project_name=project_name
        )
        director = Director(
            aws_service=aws_service,
            project_name=project_name
        )

        script = await director.get_script()
        
        # Generate a unique filename for this narration
        audio_path = f"{script.project_details.project}/chapter_{request.chapter_number}/scene_{request.scene_number}/narration.wav"
        
        # Generate the audio
        await sound_generator._generate_audio_from_text(request.text, audio_path)
        
        # Get the local path to the generated audio
        local_path = sound_generator.temp_dir / audio_path
        
        # Return the audio file
        return FileResponse(
            path=str(local_path),
            media_type="audio/wav",
            filename="narration.wav"
        )
        
    except Exception as e:
        logger.error(f"Error generating narration: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/check-narration/{project_name}")
async def check_narration(
    project_name: str,
    chapter_number: int,
    scene_number: int
):
    """Check if narration audio file exists for the given chapter and scene"""
    try:
        aws_service = AWSService(project_name=project_name)
        sound_generator = SoundGenerator(
            aws_service=aws_service,
            project_name=project_name
        )
        director = Director(
            aws_service=aws_service,
            project_name=project_name
        )

        script = await director.get_script()
        audio_path = f"{script.project_details.project}/chapter_{chapter_number}/scene_{scene_number}/narration.wav"
        local_path = sound_generator.temp_dir / audio_path

        if local_path.exists():
            return FileResponse(
                path=str(local_path),
                media_type="audio/wav",
                filename="narration.wav"
            )
        else:
            return {"status": "not_found"}
            
    except Exception as e:
        logger.error(f"Error checking narration: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))