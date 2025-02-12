import json
import logging
from typing import List
from pathlib import Path
from src.models.models import (
    ProjectDetails,
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
        request: ProjectDetails,
        chapter: Chapter,
        max_retries: int = 10,
    ) -> List[Scene]:
        """Generate scenes for a specific chapter with retry mechanism."""
        prompt_template = await self._load_prompt(
            request.genre, "scenes_generation_prompt.txt"
        )
        prev_error = "N/A"
        remaining_attempts = max_retries
        for scene_number in range(request.number_of_scenes):
            prompt = await self._format_prompt(
                prompt_template,
                genre=request.genre,
                subject=request.subject,
                movie_general_instructions=request.movie_general_instructions,
                story_background=request.story_background,
                chapter_high_level_description=chapter.chapter_description,
                previous_scenes=chapter.scenes,
                scene_number=scene_number,
                number_of_scenes=request.number_of_scenes,
                narration_instructions=request.narration_instructions,
                previous_generation_error=prev_error,
                
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
                    movie_general_instructions=request.movie_general_instructions,
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

            except Exception as e:
                prev_error = (
                    f"Unexpected Error: {str(e)} | {max_retries} attempts: {str(e)}"
                )
                prev_error = f"{str(e)}"
                remaining_attempts = remaining_attempts = 1
                if remaining_attempts == 0:
                    logger.error("No more attempts, Failure")
                    raise

        raise Exception(f"Failed to generate scenes after {max_retries} attempts")

    async def _get_previous_scenes_instructions(self, chapter: Chapter) -> str:
        """Get director instructions from previous shots or return 'N/A' if none exist."""
        if not chapter.scenes:
            return "N/A"

        previous_general_scene_description_and_motivations = []
        previous_main_characters = []
        previous_key_events = []
        for scene in chapter.scenes:
            if scene.general_scene_description_and_motivations:
                previous_general_scene_description_and_motivations.append(
                    f"Scene {scene.scene_number}: {scene.general_scene_description_and_motivations}"
                )
                
            if scene.main_characters:
                previous_main_characters.append(
                    f"Scene {scene.scene_number}: {scene.main_characters}"
                )
                
            if scene.key_events:
                previous_key_events.append(
                    f"Scene {scene.scene_number}: {scene.key_events}"
                )

        response = "\n".join(previous_general_scene_description_and_motivations) 
        response += "\n".join(previous_key_events) 
        response += "\n".join(previous_main_characters) 
        return response
        

    def _get_previous_shots_instructions(self, scene: Scene) -> str:
        """Get director instructions from previous shots or return 'N/A' if none exist."""
        if not scene.shots:
            return "N/A"

        previous_instructions = []
        for shot in scene.shots:
            if shot.shot_director_instructions:
                previous_instructions.append(
                    f"Shot {shot.shot_number}: {shot.shot_director_instructions}"
                )

        return "\n".join(previous_instructions) if previous_instructions else "N/A"

    async def generate_shots(
        self,
        max_retries: int = 10,
    ) -> Script:
        """Generate shots for a specific scene with retry mechanism."""
        script = await self.get_script()
        prompt_template = await self._load_prompt(
            script.project_details.genre, "single_shot_generation_prompt.txt"
        )

        for chapter in script.chapters:
            if chapter.scenes:
                for scene in chapter.scenes:
                    scene.shots = []
                    remaining_attempts = max_retries
                    prev_error = "N/A"
                    for i in range(script.project_details.number_of_shots):
                        try:
                            logger.info(
                                f"Shot generation attempt {max_retries - remaining_attempts + 1}/{max_retries}"
                            )
                            # Prepare previous shots information if needed for the prompt
                            prompt = await self._format_prompt(
                                prompt_template,
                                genre=script.project_details.genre,
                                subject=script.project_details.subject,
                                shot_number=i,
                                total_shots=script.project_details.number_of_shots,
                                movie_general_instructions=script.project_details.movie_general_instructions,
                                general_scene_description_and_motivations=scene.general_scene_description_and_motivations,
                                story_background=script.project_details.story_background,
                                chapter_high_level_description=scene.general_scene_description_and_motivations,
                                scene_overview=scene.general_scene_description_and_motivations,
                                previous_shots=self._get_previous_shots_instructions(
                                    scene=scene
                                ),
                                previous_generation_error=prev_error,
                                number_of_shots=script.project_details.number_of_shots,
                            )

                            response = await self.aws_service.invoke_llm(
                                prompt, prev_errors=prev_error
                            )
                            scene.shots.append(parse_shot_response(response))

                            await self.save_script(script)
                            break  # Success, exit retry loop

                        except Exception as e:
                            prev_error = f"{str(e)}"
                            remaining_attempts -= 1
                            if remaining_attempts == 0:
                                logger.error(
                                    f"Unexpected error generating shot after {max_retries} attempts: {str(e)}"
                                )
                                raise
                            logger.warning(
                                f"Unexpected error generating shot (attempt {max_retries - remaining_attempts}/{max_retries}): {str(e)}"
                            )
                            logger.info("Retrying shot generation...")
        return script

    async def _ensure_temp_dir(self, project_name: str) -> Path:
        """Ensure the temporary directory exists for the project."""
        temp_dir = self.temp_base_path / project_name
        temp_dir.mkdir(parents=True, exist_ok=True)
        return temp_dir

    async def generate_chapters(
        self,
        request: ProjectDetails,
        max_retries: int = 10,
    ) -> List[Chapter]:
        """Generate chapters for the video with retry mechanism."""
        prompt_template = await self._load_prompt(
            request.genre, "chapters_generation_prompt.txt"
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
                    movie_general_instructions=request.movie_general_instructions,
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
                    logger.error(
                        f"Failed to parse chapter response after {max_retries} attempts"
                    )
                    raise
                logger.warning(
                    f"Failed to parse chapter response (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )
                logger.info("Retrying chapter generation...")
            except Exception as e:
                prev_error = f"Unexpected Error: {str(e)}"
                if attempt == max_retries - 1:
                    logger.error(
                        f"Unexpected error generating chapter after {max_retries} attempts: {str(e)}"
                    )
                    raise
                logger.warning(
                    f"Unexpected error generating chapter (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )
                logger.info("Retrying chapter generation...")

        raise Exception(f"Failed to generate chapter after {max_retries} attempts")

    async def create_script(
        self,
        request: ProjectDetails,
        scenes_per_chapter: int = 3,
        shots_per_scene: int = 3,
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
            logger.info(
                f"\nGenerating scenes for chapter {chapter.chapter_number}: {chapter.chapter_title}"
            )
            scenes = await self.generate_scenes(request, chapter, scenes_per_chapter)

            # # Generate shots for each scene
            # for scene in scenes:
            #     logger.info(f"Generating shots for scene {scene.scene_number} in chapter {chapter.chapter_number}")
            #     shots = await self.generate_shots(
            #         request,
            #         scene,
            #         shots_per_scene
            #     )
            #     scene.shots = shots
            #     logger.info(f"Generated {len(shots)} shots for scene {scene.scene_number}")

            chapter.scenes = scenes
            logger.info(
                f"Generated {len(scenes)} scenes for chapter {chapter.chapter_number}"
            )

        logger.info("\nScript generation completed successfully!")
        logger.info(
            f"Generated {len(chapters)} chapters with {sum(len(chapter.scenes or []) for chapter in chapters)} total scenes"
        )

        # Create and return the complete script
        script = Script(chapters=chapters, project_details=request)

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

def parse_shot_response(response: str) -> Shot:
    try:
        # Clean the response string
        cleaned_response = (
            response.strip()                    # Remove leading/trailing whitespace
            .replace("\'", "")               # Replace single quotes with double quotes
        )
        
        # Parse JSON
        data = json.loads(cleaned_response)
        
        return Shot(**data)
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {str(e)}")
        logger.error(f"Response content: {response}")
        raise ValueError(f"Invalid JSON format: {str(e)}")
    except Exception as e:
        logger.error(f"Shot creation error: {str(e)}")
        raise ValueError(f"Failed to create Shot: {str(e)}")
