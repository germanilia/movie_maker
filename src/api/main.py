from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from src.models.models import VideoRequest, Script, RegenerateImageRequest
from src.core.director import Director
from src.core.image_generator import ImageGenerator
from src.core.video_genrator import VideoGenerator
from src.services.aws_service import AWSService
import os
from pydantic import BaseModel

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


class ProjectDetails(BaseModel):
    project: str
    genre: str
    subject: str
    special_instructions: str
    story_background: str
    number_of_chapters: int
    number_of_scenes: int
    number_of_shots: int
    black_and_white: bool


@app.post("/api/generate-script")
async def generate_script(project_details: ProjectDetails):
    """Generate a new script based on project details"""
    try:
        director = Director(
            aws_service=AWSService(project_name=project_details.project),
            project_name=project_details.project,
        )
        # Convert ProjectDetails to VideoRequest
        video_request = VideoRequest(**project_details.dict())
        script = await director.create_script(video_request)
        return {"message": "Script generated successfully", "script": script}
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
    background_tasks: BackgroundTasks
):
    """Regenerate a specific image with optional custom prompt"""
    try:
        aws_service = AWSService(project_name=project_name)
        image_generator = ImageGenerator(
            aws_service=aws_service,
            black_and_white=True,
            genre="documentary",
        )
        
        # Get the script to access the original prompt if no custom prompt provided
        script = await Director(aws_service=aws_service, project_name=project_name).get_script()
        
        # Get the shot from the script
        if not script or not script.chapters:
            raise HTTPException(status_code=404, detail="Script or chapters not found")
            
        chapter = script.chapters[request.chapter_index]
        if not chapter or not chapter.scenes:
            raise HTTPException(status_code=404, detail="Chapter or scenes not found")
            
        scene = chapter.scenes[request.scene_index]
        if not scene or not scene.shots:
            raise HTTPException(status_code=404, detail="Scene or shots not found")
            
        shot = scene.shots[request.shot_index]
        if not shot:
            raise HTTPException(status_code=404, detail="Shot not found")
        
        # Add 1 to each index to match the folder structure
        opening_image_path = f"chapter_{request.chapter_index + 1}/scene_{request.scene_index + 1}/shot_{request.shot_index + 1}_opening.png"
        
        # Use custom prompt if provided, otherwise use the original prompt
        prompt = request.custom_prompt if request.custom_prompt else shot.detailed_opening_scene_description
        
        # Generate the image directly instead of using regenerate_single_image
        background_tasks.add_task(
            image_generator.generate_image,
            prompt=prompt,
            image_path=opening_image_path,
            seed=None,  # Generate new random seed
            overwrite_image=True
        )
        
        return {
            "status": "success", 
            "message": "Image regeneration started",
            "chapter_index": request.chapter_index,
            "scene_index": request.scene_index,
            "shot_index": request.shot_index
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
                        # Get image data as base64
                        # opening_image_data = await aws_service.get_file_as_base64(f"{project_name}/{opening_image_path}")
                        # print(f"Opening image data length: {len(opening_image_data) if opening_image_data else 0}")  # Debug line
                        images.append(
                            {
                                "url": f"{aws_service.s3_object_uri}/{opening_image_path}",
                                # "base64": opening_image_data,
                                "chapter_index": chapter_idx,
                                "scene_index": scene_idx,
                                "shot_index": shot_idx,
                                "type": "opening",
                                "status": "completed",
                                "description": shot.detailed_opening_scene_description,
                            }
                        )

                    if closing_exists:
                        # Get image data as base64
                        # closing_image_data = await aws_service.get_file_as_base64(f"{project_name}/{closing_image_path}")
                        # print(f"Closing image data length: {len(closing_image_data) if closing_image_data else 0}")  # Debug line
                        images.append(
                            {
                                "url": f"{aws_service.s3_object_uri}/{closing_image_path}",
                                # "base64": closing_image_data,
                                "chapter_index": chapter_idx,
                                "scene_index": scene_idx,
                                "shot_index": shot_idx,
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
                                "chapter_index": chapter_idx,
                                "scene_index": scene_idx,
                                "shot_index": shot_idx,
                                "type": "opening",
                                "status": "pending",
                                "description": shot.detailed_opening_scene_description,
                            }
                        )

                    if not closing_exists:
                        images.append(
                            {
                                "url": f"{aws_service.s3_base_uri}/{closing_image_path}",
                                "chapter_index": chapter_idx,
                                "scene_index": scene_idx,
                                "shot_index": shot_idx,
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
