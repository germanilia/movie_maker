import logging
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from src.models.models import ProjectDetails, Script, RegenerateImageRequest
from src.core.director import Director
from src.core.image_generator import ImageGenerator
from src.core.video_genrator import VideoGenerator
from src.services.aws_service import AWSService
import os
from pydantic import BaseModel

app = FastAPI(title="Video Creator API")
logger = logging.getLogger(__name__)
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
async def generate_shots(project_name: str) -> Script:
    """Generate shots for a specific scene with retry mechanism."""
    try:
        director = Director(
            aws_service=AWSService(project_name=project_name),
            project_name=project_name,
        )
        # video_request = ProjectDetails(**project_details.model_dump())
        script = await director.generate_shots()
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


@app.post("/api/generate-images/{project_name}")
async def generate_images(
    project_name: str, script: Script, background_tasks: BackgroundTasks
):
    """Generate images for a script"""
    try:
        image_generator = ImageGenerator(
            aws_service=AWSService(project_name=project_name),
            black_and_white=True,  # This should come from the script/request
            genre="documentary",  # This should come from the script/request
        )
        # Add the image generation task to background tasks
        background_tasks.add_task(image_generator.generate_images_for_script, script)
        return {
            "status": "success",
            "message": "Images generation started in background",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/regenerate-image/{project_name}")
async def regenerate_image(
    project_name: str,
    request: RegenerateImageRequest,
):
    """Regenerate a specific image with optional custom prompt"""
    aws_service = AWSService(project_name=project_name)
    image_generator = ImageGenerator(
        aws_service=aws_service,
        black_and_white=True,
        genre="documentary",
    )

    script = await Director(
        aws_service=aws_service, project_name=project_name
    ).get_script()

    chapter = script.chapters[request.chapter_index - 1]
    if not chapter.scenes:
        raise HTTPException(status_code=400, detail="No scenes in chapter")

    scene = chapter.scenes[request.scene_index - 1]
    if not scene.shots:
        raise HTTPException(status_code=400, detail="No shots in scene")
    shot = scene.shots[request.shot_index - 1]

    opening_image_path = f"chapter_{request.chapter_index}/scene_{request.scene_index}/shot_{request.shot_index}_opening.png"

    prompt = (
        request.custom_prompt
        if request.custom_prompt
        else shot.detailed_opening_scene_description
    )

    await image_generator.generate_image(
        prompt=str(prompt),
        image_path=opening_image_path,
        seed=None,
        overwrite_image=True,
    )

    return {
        "status": "success",
        "message": "Image regeneration completed",
        "chapter_index": request.chapter_index,
        "scene_index": request.scene_index,
        "shot_index": request.shot_index,
    }


@app.get("/api/images/{project_name}")
async def get_images(project_name: str):
    """Get all generated images for a project"""
    try:
        aws_service = AWSService(project_name=project_name)
        script = await Director(
            aws_service=aws_service, project_name=project_name
        ).get_script()

        images = []
        for chapter_idx, chapter in enumerate(script.chapters):
            for scene_idx, scene in enumerate(chapter.scenes or []):
                for shot_idx, shot in enumerate(scene.shots or []):
                    opening_image_path = f"chapter_{chapter_idx + 1}/scene_{scene_idx + 1}/shot_{shot_idx + 1}_opening.png"
                    closing_image_path = f"chapter_{chapter_idx + 1}/scene_{scene_idx + 1}/shot_{shot_idx + 1}_closing.png"

                    # Check if images exist in S3
                    opening_exists = await aws_service.file_exists(
                        f"images/{opening_image_path}"
                    )
                    closing_exists = await aws_service.file_exists(
                        f"images/{closing_image_path}"
                    )

                    if opening_exists:
                        images.append(
                            {
                                "url": f"{aws_service.s3_object_uri}/{opening_image_path}",
                                "chapter_index": chapter_idx + 1,
                                "scene_index": scene_idx + 1,
                                "shot_index": shot_idx + 1,
                                "type": "opening",
                                "status": "completed",
                                "description": shot.detailed_opening_scene_description,
                            }
                        )

                    if closing_exists:
                        images.append(
                            {
                                "url": f"{aws_service.s3_object_uri}/{closing_image_path}",
                                "chapter_index": chapter_idx + 1,
                                "scene_index": scene_idx + 1,
                                "shot_index": shot_idx + 1,
                                "type": "closing",
                                "status": "completed",
                                "description": shot.detailed_closing_scene_description,
                            }
                        )

                    # If image doesn't exist, add placeholder
                    if not opening_exists:
                        images.append(
                            {
                                "url": f"{aws_service.s3_object_uri}/{closing_image_path}",
                                "chapter_index": chapter_idx + 1,
                                "scene_index": scene_idx + 1,
                                "shot_index": shot_idx + 1,
                                "type": "opening",
                                "status": "pending",
                                "description": shot.detailed_opening_scene_description,
                            }
                        )

                    if not closing_exists:
                        images.append(
                            {
                                "url": f"{aws_service.s3_base_uri}/{closing_image_path}",
                                "chapter_index": chapter_idx + 1,
                                "scene_index": scene_idx + 1,
                                "shot_index": shot_idx + 1,
                                "type": "closing",
                                "status": "pending",
                                "description": shot.detailed_closing_scene_description,
                            }
                        )

        return images
    except Exception as e:
        print(f"Error in get_images: {str(e)}")  # Debug line
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


@app.get("/")
async def root():
    """Serve the frontend index.html or API information if frontend is not built"""
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "name": "Video Creator API",
        "version": "1.0.0",
        "description": "API for generating video content from scripts",
        "endpoints": {
            "generate_script": "/api/generate-script",
            "update_script": "/api/update-script/{project_name}",
            "generate_images": "/api/generate-images/{project_name}",
            "regenerate_image": "/api/regenerate-image/{project_name}",
            "get_images": "/api/images/{project_name}",
            "generate_video": "/api/generate-video/{project_name}",
        },
    }
