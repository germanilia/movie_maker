from core.image_generator import ImageGenerator
from core.sound_generator import SoundGenerator
from core.video_genrator import VideoGenerator
from services.aws_service import AWSService
from core.director import Director
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import json
import os

import asyncio
from utils.request_loader import read_video_request
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

load_dotenv()
app = FastAPI()

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

@app.put("/api/update-shot-description/{project_name}")
async def update_shot_description(project_name: str, update_data: dict):
    try:
        # Load the current script
        script_path = f"projects/{project_name}/script.json"
        if not os.path.exists(script_path):
            raise HTTPException(status_code=404, detail="Script not found")

        with open(script_path, 'r') as f:
            script = json.load(f)
        
        # Update the specific shot description
        chapter = script['chapters'][update_data['chapter_index']]
        scene = chapter['scenes'][update_data['scene_index']]
        shot = scene['shots'][update_data['shot_index']]
        
        # Update the shot description
        shot['detailed_shot_description'] = update_data['description']
        
        # Save the updated script
        with open(script_path, 'w') as f:
            json.dump(script, f, indent=2)
        
        return {"status": "success"}
    except IndexError:
        raise HTTPException(
            status_code=400, 
            detail="Invalid chapter, scene, or shot index"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
