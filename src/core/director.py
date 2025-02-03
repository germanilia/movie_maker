import json
import logging
import asyncio
from typing import List
from pathlib import Path
from src.models.models import (
    VideoRequest,
    Script,
    Chapter,
    Scene,
    Shot,
)
from src.services.aws_service import AWSService

logger = logging.getLogger(__name__)


class Director:
    def __init__(self, aws_service: AWSService, project_name: str):
        self.aws_service = aws_service
        self.prompts_base_path = Path("src/prompts")
        self.temp_base_path = Path("temp")
        self.project_name = project_name

    async def _load_prompt(self, genre: str, prompt_name: str) -> str:
        """Load a prompt file based on genre and name."""
        prompt_path = self.prompts_base_path / genre / prompt_name
        with open(prompt_path, "r") as f:
            return f.read()

    async def _load_common_prompt(self, prompt_name: str) -> str:
        """Load a prompt file from the common directory."""
        prompt_path = self.prompts_base_path / "common" / prompt_name
        with open(prompt_path, "r") as f:
            return f.read()

    async def _format_prompt(self, prompt_template: str, **kwargs) -> str:
        """Format a prompt template with the given kwargs."""
        return prompt_template.format(**kwargs)

    async def generate_scenes(
        self,
        request: VideoRequest,
        chapter: Chapter,
        max_retries: int = 10,
    ) -> List[Scene]:
        """Generate scenes for a specific chapter with retry mechanism."""
        prompt_template = await self._load_prompt(
            request.genre, "scene_generation_prompt.txt"
        )

        prev_error = "N/A"
        for attempt in range(max_retries):
            try:
                logger.info(f"Scene generation attempt {attempt + 1}/{max_retries}")
                prompt = await self._format_prompt(
                    prompt_template,
                    previous_generation_error=prev_error,
                    number_of_scenes=request.number_of_scenes,
                    genre=request.genre,
                    subject=request.subject,
                    special_instructions=request.special_instructions,
                    story_background=request.story_background,
                    chapter_high_level_description=chapter.chapter_description,
                )

                response = await self.aws_service.invoke_llm(
                    prompt, prev_errors=prev_error
                )
                scenes_data = json.loads(response)
                
                # Convert the response into Scene objects
                scenes = []
                for idx, scene_data in enumerate(scenes_data["scenes"], 1):
                    scene = Scene(**scene_data)
                    scene.scene_number = idx
                    scenes.append(scene)
                
                return scenes
                
            except json.JSONDecodeError as e:
                prev_error = f"JSON Parse Error: {str(e)}"
                if attempt == max_retries - 1:  # Last attempt
                    logger.error(
                        f"Failed to parse scene response after {max_retries} attempts"
                    )
                    raise
                logger.warning(
                    f"Failed to parse scene response (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )
                logger.info("Retrying scene generation...")
            except Exception as e:
                prev_error = f"Unexpected Error: {str(e)}"
                if attempt == max_retries - 1:  # Last attempt
                    logger.error(
                        f"Unexpected error generating scene after {max_retries} attempts: {str(e)}"
                    )
                    raise
                logger.warning(
                    f"Unexpected error generating scene (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )
                logger.info("Retrying scene generation...")

        raise Exception(f"Failed to generate scenes after {max_retries} attempts")

    async def generate_shots(
        self,
        request: VideoRequest,
        scene: Scene,
        max_retries: int = 10,
    ) -> List[Shot]:
        """Generate shots for a specific scene with retry mechanism."""
        prompt_template = await self._load_prompt(
            request.genre, "shot_generation_prompt.txt"
        )

        prev_error = "N/A"
        for attempt in range(max_retries):
            try:
                logger.info(f"Shot generation attempt {attempt + 1}/{max_retries}")
                
                # Prepare previous shots information if needed for the prompt
                prompt = await self._format_prompt(
                    prompt_template,
                    previous_generation_error=prev_error,
                    number_of_shots=request.number_of_shots,
                    genre=request.genre,
                    subject=request.subject,
                    special_instructions=request.special_instructions,
                    story_background=request.story_background,
                    chapter_high_level_description=scene.general_scene_description_and_motivations,
                    scene_overview=scene.general_scene_description_and_motivations,
                    main_character_description=request.main_character_description,
                )

                response = await self.aws_service.invoke_llm(
                    prompt, prev_errors=prev_error
                )
                shots_data = json.loads(response)
                
                # Convert all shots from the response into Shot objects
                shots = []
                for idx, shot_data in enumerate(shots_data["shots"], 1):
                    shot = Shot(**shot_data)
                    shot.shot_number = idx
                    shots.append(shot)
                
                return shots
                
            except json.JSONDecodeError as e:
                prev_error = f"JSON Parse Error: {str(e)}"
                if attempt == max_retries - 1:  # Last attempt
                    logger.error(
                        f"Failed to parse shot response after {max_retries} attempts"
                    )
                    raise
                logger.warning(
                    f"Failed to parse shot response (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )
                logger.info("Retrying shot generation...")
            except Exception as e:
                prev_error = f"Unexpected Error: {str(e)}"
                if attempt == max_retries - 1:  # Last attempt
                    logger.error(
                        f"Unexpected error generating shot after {max_retries} attempts: {str(e)}"
                    )
                    raise
                logger.warning(
                    f"Unexpected error generating shot (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )
                logger.info("Retrying shot generation...")

        raise Exception(f"Failed to generate shots after {max_retries} attempts")

    async def _ensure_temp_dir(self, project_name: str) -> Path:
        """Ensure the temporary directory exists for the project."""
        temp_dir = self.temp_base_path / project_name
        temp_dir.mkdir(parents=True, exist_ok=True)
        return temp_dir

    async def generate_chapters(
        self,
        request: VideoRequest,
        max_retries: int = 10,
    ) -> List[Chapter]:
        """Generate chapters for the video with retry mechanism."""
        prompt_template = await self._load_prompt(
            request.genre, "chapter_generation.txt"
        )

        prev_error = "N/A"
        for attempt in range(max_retries):
            try:
                logger.info(f"Chapter generation attempt {attempt + 1}/{max_retries}")
                prompt = await self._format_prompt(
                    prompt_template,
                    number_of_chapters=request.number_of_chapters,
                    previous_generation_error=prev_error,
                    genre=request.genre,
                    subject=request.subject,
                    special_instructions=request.special_instructions,
                    story_background=request.story_background,
                )

                response = await self.aws_service.invoke_llm(
                    prompt, prev_errors=prev_error
                )
                chapter_data = json.loads(response)
                return [Chapter(**chapter) for chapter in chapter_data["chapters"]]
            except json.JSONDecodeError as e:
                prev_error = f"JSON Parse Error: {str(e)}"
                if attempt == max_retries - 1:
                    logger.error(f"Failed to parse chapter response after {max_retries} attempts")
                    raise
                logger.warning(f"Failed to parse chapter response (attempt {attempt + 1}/{max_retries}): {str(e)}")
                logger.info("Retrying chapter generation...")
            except Exception as e:
                prev_error = f"Unexpected Error: {str(e)}"
                if attempt == max_retries - 1:
                    logger.error(f"Unexpected error generating chapter after {max_retries} attempts: {str(e)}")
                    raise
                logger.warning(f"Unexpected error generating chapter (attempt {attempt + 1}/{max_retries}): {str(e)}")
                logger.info("Retrying chapter generation...")

        raise Exception(f"Failed to generate chapter after {max_retries} attempts")

    async def create_script(
        self, request: VideoRequest, scenes_per_chapter: int = 3, shots_per_scene: int = 3
    ) -> Script:
        """
        Create a complete script by generating chapters, scenes, and shots.
        Then review the script for consistency and quality.

        Args:
            request: The video request containing project details
            scenes_per_chapter: Number of scenes to generate per chapter
            shots_per_scene: Number of shots per scene

        Returns:
            A reviewed script with all chapters and scenes
        """

        # Create temp directory for this project
        temp_dir = await self._ensure_temp_dir(request.project)

        # Check if script exists
        script_path = f"{self.aws_service.s3_base_uri}/script.json"
        if await self.aws_service.file_exists(script_path):
            logger.info("Script already exists, loading existing script")
            return await self._load_script(temp_dir)
        
        logger.info(
            f"Starting script generation for project '{request.project}' ({request.genre})"
        )

        # Generate chapters
        logger.info("Generating chapters...")
        chapters = await self.generate_chapters(request)
        logger.info(f"Generated {len(chapters)} chapters")

        # Generate scenes and shots for each chapter
        for chapter in chapters:
            logger.info(f"\nGenerating scenes for chapter {chapter.chapter_number}: {chapter.chapter_title}")
            scenes = await self.generate_scenes(request, chapter, scenes_per_chapter)
            
            # Generate shots for each scene
            for scene in scenes:
                logger.info(f"Generating shots for scene {scene.scene_number} in chapter {chapter.chapter_number}")
                shots = await self.generate_shots(
                    request,
                    scene,
                    shots_per_scene
                )
                scene.shots = shots
                logger.info(f"Generated {len(shots)} shots for scene {scene.scene_number}")
            
            chapter.scenes = scenes
            logger.info(f"Generated {len(scenes)} scenes for chapter {chapter.chapter_number}")

        logger.info("\nScript generation completed successfully!")
        logger.info(
            f"Generated {len(chapters)} chapters with {sum(len(chapter.scenes or []) for chapter in chapters)} total scenes"
        )

        # Create and return the complete script
        script = Script(chapters=chapters)

        # Save the script at the end
        await self._save_script(script)
        
        return script

    async def _load_script(self, temp_dir: Path) -> Script:
        """Load script from local temp directory or download from S3."""
        script_path = temp_dir / "script.json"
        
        if not script_path.exists():
            # Download from S3 if not in temp
            s3_path = f"{self.aws_service.s3_base_uri}/script.json"
            await self.aws_service.download_file(s3_path, str(script_path))
        
        with open(script_path, "r") as f:
            script_data = json.load(f)
        
        return Script(**script_data)

    async def _save_script(self, script: Script) -> None:
        """Save script to temp directory and S3."""
        temp_dir = self.temp_base_path / self.project_name
        script_path = temp_dir / "script.json"
        
        # Save locally
        script_path.parent.mkdir(parents=True, exist_ok=True)
        with open(script_path, "w") as f:
            json.dump(script.model_dump(), f, indent=2)
        
        # Upload to S3
        s3_path = f"{self.aws_service.s3_base_uri}/script.json"
        await self.aws_service.upload_file(str(script_path), s3_path)

    async def get_script(self) -> Script:
        """Get the current script for the project."""
        try:
            return await self._load_script(self.temp_base_path / self.project_name)
        except Exception as e:
            logger.error(f"Failed to get script: {str(e)}")
            raise

    async def save_script(self, script: Script) -> None:
        """Save the provided script for the project."""
        try:
            await self._save_script(script)
            logger.info(f"Successfully saved script for project {self.project_name}")
        except Exception as e:
            logger.error(f"Failed to save script: {str(e)}")
            raise

    async def update_shot_description(self, chapter_index: int, scene_index: int, shot_index: int, description: str) -> None:
        """Update a specific shot's description and save the updated script."""
        try:
            # Get current script
            script = await self.get_script()
            
            # Update the specific shot description
            chapter = script.chapters[chapter_index]
            scene = chapter.scenes[scene_index]
            shot = scene.shots[shot_index]
            shot.detailed_shot_description = description
            
            # Save the updated script (this will save both locally and to AWS)
            await self._save_script(script)
            
            logger.info(f"Successfully updated shot description for project {self.project_name}")
        except IndexError:
            logger.error(f"Invalid indices provided: chapter={chapter_index}, scene={scene_index}, shot={shot_index}")
            raise
        except Exception as e:
            logger.error(f"Failed to update shot description: {str(e)}")
            raise

   