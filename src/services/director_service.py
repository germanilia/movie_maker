import json
import logging
import sys
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

# Configure logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Get the logger for this module
logger = logging.getLogger(__name__)


class DirectorService:
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
            request.genre, "single_scene_generation_prompt.txt"
        )
        scenes = []
        prev_error = "N/A"

        for scene_number in range(request.number_of_scenes):
            remaining_attempts = max_retries
            scene_generated = False

            while remaining_attempts > 0 and not scene_generated:
                try:
                    logger.info(
                        f"Generating scene {scene_number + 1}/{request.number_of_scenes} (attempt {max_retries - remaining_attempts + 1}/{max_retries})"
                    )
                    prompt = await self._format_prompt(
                        prompt_template,
                        genre=request.genre,
                        subject=request.subject,
                        movie_general_instructions=request.movie_general_instructions,
                        story_background=request.story_background,
                        chapter_high_level_description=chapter.chapter_description,
                        previous_scenes=scenes,
                        scene_number=scene_number + 1,
                        number_of_scenes=request.number_of_scenes,
                        narration_instructions=request.narration_instructions,
                        previous_generation_error=prev_error,
                    )

                    response = await self.aws_service.invoke_llm(
                        prompt, prev_errors=prev_error
                    )
                    scene = Scene(**json.loads(response))
                    scene.scene_number = scene_number + 1
                    scenes.append(scene)
                    scene_generated = True

                    # Handle the new response format where scene is the root key
                    # if "scene" in scene_data:
                    # else:
                    #     raise ValueError("Invalid scene response format: missing 'scene' key")

                except json.JSONDecodeError as e:
                    prev_error = (
                        f"JSON parsing error for scene {scene_number + 1}: {str(e)}"
                    )
                    remaining_attempts -= 1
                except Exception as e:
                    prev_error = f"Error generating scene {scene_number + 1}: {str(e)}"
                    remaining_attempts -= 1

                if remaining_attempts == 0 and not scene_generated:
                    logger.error(
                        f"Failed to generate scene {scene_number + 1} after {max_retries} attempts: {prev_error}"
                    )
                    raise Exception(
                        f"Failed to generate scene {scene_number + 1} after {max_retries} attempts"
                    )
                elif not scene_generated:
                    logger.warning(
                        f"Retrying scene generation... ({remaining_attempts} attempts left)"
                    )

        return scenes

    def _get_previous_scenes_instructions(
        self, chapter: Chapter, total_scenes: int, current_scene:int
    ) -> str:
        """Get director instructions from previous shots or return 'N/A' if none exist."""
        if not chapter.scenes:
            return "N/A"

        previous_main_story = []
        previous_narration_text = []
        previous_reasoning = []
        for scene in chapter.scenes:
            if scene.scene_number == current_scene:
                break
            if scene.main_story:
                previous_main_story.append(
                    f"Scene {scene.scene_number}: {scene.main_story}"
                )

            if scene.narration_text:
                previous_narration_text.append(
                    f"Scene {scene.scene_number}: {scene.narration_text}"
                )

            if scene.reasoning:
                previous_reasoning.append(
                    f"Scene {scene.scene_number}: {scene.reasoning}"
                )

        response = f"Scene number:{scene.scene_number}/{total_scenes} In chapter number: {chapter.chapter_number}\n"
        response += "\n".join(previous_main_story)
        response += "\n".join(previous_reasoning)
        response += "\n".join(previous_narration_text)
        return response

    def _get_previous_shots_instructions(
        self, scene: Scene, chapter: Chapter, script: Script
    ) -> str:
        """Get director instructions from previous shots or return 'N/A' if none exist."""
        if not scene.shots:
            return "N/A"

        previous_instructions = []
        for shot in scene.shots:
            if shot.director_instructions:
                previous_instructions.append(
                    f"Shot {shot.shot_number}/{script.project_details.number_of_shots} in scene {scene.scene_number}/{script.project_details.number_of_scenes} in chapter {chapter.chapter_number}/{script.project_details.number_of_chapters} director instructions : {shot.director_instructions}\nShot {shot.shot_number}/{script.project_details.number_of_shots}"
                )

        return "\n".join(previous_instructions) if previous_instructions else "N/A"

    async def generate_shots(
        self,
        script: Script,
        max_retries: int = 10,
    ) -> Script:
        """Generate shots for a specific scene with retry mechanism."""
        prompt_template = await self._load_prompt(
            script.project_details.genre, "single_shot_generation_prompt.txt"
        )

        for chapter in script.chapters:
            if chapter.scenes:
                for scene in chapter.scenes:
                    if scene.shots is None:
                        scene.shots = []

                    # Calculate how many shots we need to generate
                    existing_shots = len(scene.shots)

                    if existing_shots >= script.project_details.number_of_shots:
                        logger.info(
                            f"Scene {scene.scene_number} already has all required shots"
                        )
                        continue

                    remaining_attempts = max_retries
                    prev_error = "N/A"
                    for i in range(
                        existing_shots, script.project_details.number_of_shots
                    ):
                        try:
                            logger.info(
                                f"Shot generation attempt {max_retries - remaining_attempts + 1}/{max_retries}"
                            )
                            prompt = await self._format_prompt(
                                prompt_template,
                                genre=script.project_details.genre,
                                black_and_white=(
                                    "Black and white image"
                                    if script.project_details.black_and_white
                                    else "Color image"
                                ),
                                subject=script.project_details.subject,
                                shot_number=i + 1,
                                total_shots=script.project_details.number_of_shots,
                                scene_number=scene.scene_number,
                                total_scenes=script.project_details.number_of_scenes,
                                chapter_number=chapter.chapter_number,
                                total_chapters=script.project_details.number_of_chapters,
                                movie_general_instructions=script.project_details.movie_general_instructions,
                                general_scene_description_and_motivations=scene.main_story,
                                story_background=script.project_details.story_background,
                                chapter_high_level_description=chapter.chapter_description,
                                previous_shots=self._get_previous_shots_instructions(
                                    scene=scene, script=script, chapter=chapter
                                ),
                                previous_scenes=self._get_previous_scenes_instructions(
                                    chapter=chapter,
                                    total_scenes=script.project_details.number_of_scenes,
                                    current_scene=scene.scene_number,
                                ),
                                previous_generation_error=prev_error,
                            )

                            response = await self.aws_service.invoke_llm(
                                prompt, prev_errors=prev_error
                            )
                            shot = parse_shot_response(response)
                            shot.shot_number = i + 1
                            scene.shots.append(shot)

                            await self.save_script(script)

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
                    number_of_scenes=request.number_of_scenes,
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
                chapters = [Chapter(**chapter) for chapter in chapter_data["chapters"]]

                # Set chapter numbers sequentially
                for i, chapter in enumerate(chapters, 0):
                    chapter.chapter_number = i + 1

                return chapters
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
        script = await self._try_load_script(temp_dir)
        if script:
            logger.info(f"Loaded existing script for project '{request.project}'")
            script = await self.generate_shots(script, request.number_of_shots)
            return script

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
            scenes = await self.generate_scenes(
                request, chapter, request.number_of_scenes
            )
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
        script = await self.generate_shots(script, request.number_of_shots)

        return script

    async def _try_load_script(self, temp_dir: Path) -> Script | None:
        """Load script from local temp directory or download from S3."""
        script_path = temp_dir / "script.json"

        if not script_path.exists():
            # Download from S3 if not in temp
            # s3_path = f"{self.aws_service.s3_base_uri}/script.json"
            # await self.aws_service.download_file(s3_path, str(script_path))
            return None

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
        # s3_path = f"{self.aws_service.s3_base_uri}/script.json"
        # await self.aws_service.upload_file(str(script_path), s3_path)

    async def get_script(self) -> Script:
        """Get the current script for the project."""
        try:
            script = await self._try_load_script(
                self.temp_base_path / self.project_name
            )
            if not script:
                raise FileNotFoundError("Script not found")
            return script
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

    async def regenerate_scene(
        self,
        script: Script,
        chapter_index: int,
        scene_index: int,
        max_retries: int = 10,
    ) -> Script:
        """Regenerate a specific scene while maintaining context."""
        chapter = script.chapters[chapter_index]
        prev_error = "N/A"
        
        prompt_template = await self._load_prompt(
            script.project_details.genre, "single_scene_generation_prompt.txt"
        )

        try:
            logger.info(
                f"Regenerating scene {scene_index + 1} in chapter {chapter_index + 1}"
            )
            prompt = await self._format_prompt(
                prompt_template,
                genre=script.project_details.genre,
                subject=script.project_details.subject,
                movie_general_instructions=script.project_details.movie_general_instructions,
                story_background=script.project_details.story_background,
                chapter_high_level_description=chapter.chapter_description,
                previous_scenes=self._get_previous_scenes_instructions(
                    chapter=chapter,
                    total_scenes=script.project_details.number_of_scenes,
                    current_scene=scene_index,
                ),
                scene_number=scene_index + 1,
                number_of_scenes=script.project_details.number_of_scenes,
                narration_instructions=script.project_details.narration_instructions,
                previous_generation_error=prev_error,
            )

            response = await self.aws_service.invoke_llm(
                prompt, prev_errors=prev_error
            )
            new_scene = Scene(**json.loads(response))
            new_scene.scene_number = scene_index + 1
            
            # Initialize empty shots list to maintain consistency
            new_scene.shots = []
            script = await self.generate_shots(script, script.project_details.number_of_shots)
            return script

        except json.JSONDecodeError as e:
            error_msg = f"JSON parsing error for scene regeneration: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"Error regenerating scene: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg)


def parse_shot_response(response: str) -> Shot:
    try:
        # Clean the response string
        cleaned_response = (
            response.strip().replace(  # Remove leading/trailing whitespace
                "'", ""
            )  # Replace single quotes with double quotes
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
