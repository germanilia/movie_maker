import json
import logging
import sys
from typing import List, Optional
from pathlib import Path
from src.models.models import (
    ProjectDetails,
    Script,
    Chapter,
    Scene,
    Shot,
)
from src.services.aws_service import AWSService
import re

# Configure logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Get the logger for this module
logger = logging.getLogger(__name__)


def to_snake_case(name: str) -> str:
    """Convert a string to snake case."""
    # Replace spaces and special characters with underscores
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    s2 = re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1)
    # Convert to lowercase and replace spaces/special chars with underscores
    return re.sub(r"[^a-z0-9]+", "_", s2.lower()).strip("_")


class DirectorService:
    def __init__(self, aws_service: AWSService, project_name: str):
        self.aws_service = aws_service
        self.prompts_base_path = Path("src/prompts")
        self.temp_base_path = Path("temp")
        self.project_name = to_snake_case(project_name)
        self.temp_dir = self.temp_base_path / self.project_name
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    async def _load_prompt(self, prompt_name: str) -> str:
        """Load a prompt file based on genre and name."""
        prompt_path = self.prompts_base_path / prompt_name
        with open(prompt_path, "r") as f:
            return f.read()

    async def _load_common_prompt(self, prompt_name: str) -> str:
        """Load a prompt file from the common directory."""
        prompt_path = self.prompts_base_path / "common" / prompt_name
        with open(prompt_path, "r") as f:
            return f.read()

    async def _format_prompt(self, prompt_template: str, **kwargs) -> str:
        """Format a prompt template with the given kwargs."""
        # Add complete script context if available
        if "script" in kwargs:
            kwargs["complete_script"] = (
                json.dumps(kwargs["script"].model_dump(), indent=2)
                if kwargs["script"]
                else "N/A"
            )
        else:
            kwargs["complete_script"] = "N/A"

        # Handle regeneration instructions
        if "regeneration_instructions" not in kwargs:
            kwargs["regeneration_instructions"] = "N/A"

        return prompt_template.format(**kwargs)

    async def generate_scenes(
        self,
        request: ProjectDetails,
        chapters: list[Chapter],
        chapter: Chapter,
        max_retries: int = 10,
    ) -> List[Scene]:
        """Generate scenes for a specific chapter with retry mechanism."""
        prompt_template = await self._load_prompt("single_scene_generation_prompt.txt")
        scenes = []
        prev_error = "N/A"

        # Create a temporary Script object to provide full context
        temp_script = Script(chapters=chapters, project_details=request)

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
                        scene_number=scene_number + 1,
                        number_of_scenes=request.number_of_scenes,
                        narration_instructions=request.narration_instructions,
                        previous_generation_error=prev_error,
                        script=temp_script,
                    )

                    response = await self.aws_service.invoke_llm(
                        prompt, prev_errors=prev_error
                    )
                    scene = Scene(**json.loads(response))
                    scene.scene_number = scene_number + 1
                    scenes.append(scene)
                    scene_generated = True

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

    async def generate_shots(
        self,
        script: Script,
        max_retries: int = 10,
        regenerate: bool = False,
        specific_chapter_index: int | None = None,
        specific_scene_index: int | None = None,
    ) -> Script:
        """Generate shots for scenes with retry mechanism.
        If specific_chapter_index and specific_scene_index are provided, only generate shots for that scene.
        """
        prompt_template = await self._load_prompt("single_shot_generation_prompt.txt")

        for chapter_idx, chapter in enumerate(script.chapters):
            if (
                specific_chapter_index is not None
                and chapter_idx != specific_chapter_index
            ):
                continue

            if chapter.scenes:
                for scene_idx, scene in enumerate(chapter.scenes):
                    if (
                        specific_scene_index is not None
                        and scene_idx != specific_scene_index
                    ):
                        continue

                    if not scene.shots or regenerate:
                        scene.shots = []
                        prev_error = "N/A"

                        for shot_number in range(
                            script.project_details.number_of_shots
                        ):
                            remaining_attempts = max_retries
                            shot_generated = False
                            logger.info(
                                f"Regenerating shot {shot_number + 1} in scene {scene.scene_number} in chapter {chapter.chapter_number}"
                            )
                            while remaining_attempts > 0 and not shot_generated:
                                try:
                                    prompt = await self._format_prompt(
                                        prompt_template,
                                        genre=script.project_details.genre,
                                        subject=script.project_details.subject,
                                        movie_general_instructions=script.project_details.movie_general_instructions,
                                        story_background=script.project_details.story_background,
                                        chapter_description=chapter.chapter_description,
                                        scene_description=scene.main_story,
                                        shot_number=shot_number + 1,
                                        number_of_shots=script.project_details.number_of_shots,
                                        previous_generation_error=prev_error,
                                        script=script,
                                    )

                                    response = await self.aws_service.invoke_llm(
                                        prompt, prev_errors=prev_error
                                    )
                                    shot = parse_shot_response(response)
                                    shot.shot_number = shot_number + 1
                                    scene.shots.append(shot)
                                    shot_generated = True

                                except json.JSONDecodeError as e:
                                    prev_error = f"JSON Parse Error: {str(e)}"
                                    remaining_attempts -= 1
                                except Exception as e:
                                    prev_error = f"Unexpected Error: {str(e)}"
                                    remaining_attempts -= 1

                                if remaining_attempts == 0 and not shot_generated:
                                    logger.error(
                                        f"Failed to generate shot {shot_number + 1} after {max_retries} attempts"
                                    )
                                    raise Exception(
                                        f"Failed to generate shot {shot_number + 1} after {max_retries} attempts"
                                    )

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
        prompt_template = await self._load_prompt("chapters_generation_prompt.txt")

        prev_error = "N/A"
        temp_script = Script(
            chapters=[], project_details=request
        )  # Empty script for initial generation

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
                    script=temp_script,
                )

                response = await self.aws_service.invoke_llm(
                    prompt, prev_errors=prev_error
                )
                chapter_data = json.loads(response)
                chapters = [Chapter(**chapter) for chapter in chapter_data["chapters"]]

                # Set chapter numbers sequentially
                for i, chapter in enumerate(chapters, 1):
                    chapter.chapter_number = i

                return chapters
            except json.JSONDecodeError as e:
                prev_error = f"JSON Parse Error: {str(e)}"
                if attempt == max_retries - 1:
                    raise ValueError(f"Failed to parse chapter response: {str(e)}")
                logger.warning(
                    f"Failed to parse chapter response (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )
                logger.info("Retrying chapter generation...")
            except Exception as e:
                prev_error = f"Unexpected Error: {str(e)}"
                if attempt == max_retries - 1:
                    raise ValueError(f"Failed to generate chapters: {str(e)}")
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
        previous_chapters = []
        for chapter in chapters:
            logger.info(
                f"\nGenerating scenes for chapter {chapter.chapter_number}: {chapter.chapter_title}"
            )
            scenes = await self.generate_scenes(
                request=request,
                chapters=previous_chapters,
                chapter=chapter,
            )
            previous_chapters.append(chapter)
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
        custom_instructions: str | None = None,
        max_retries: int = 10,
    ) -> Script:
        """Regenerate a specific scene while maintaining context."""
        chapter = script.chapters[chapter_index]
        prev_error = "N/A"

        prompt_template = await self._load_prompt("single_scene_generation_prompt.txt")

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
                scene_number=scene_index + 1,
                number_of_scenes=script.project_details.number_of_scenes,
                narration_instructions=script.project_details.narration_instructions,
                previous_generation_error=prev_error,
                script=script,
                regeneration_instructions=f"This is the most important instructions of all, you are required to follow and explain in the reasoning process how did you comply {custom_instructions}"
                or "",
            )

            response = await self.aws_service.invoke_llm(prompt, prev_errors=prev_error)

            try:
                scene_data = json.loads(response)
                # Ensure proper JSON structure
                if not isinstance(scene_data, dict):
                    raise ValueError("Response is not a valid JSON object")

                new_scene = Scene(**scene_data)
                new_scene.scene_number = scene_index + 1

                # Initialize empty shots list to maintain consistency
                new_scene.shots = []

                # Initialize scenes if None and ensure proper typing
                chapter = script.chapters[chapter_index]
                if chapter.scenes is None:
                    chapter.scenes = []

                scenes = chapter.scenes
                if scenes is not None:  # Type guard for the list operations
                    while len(scenes) <= scene_index:
                        scenes.append(
                            Scene(
                                main_story="",
                                narration_text="",
                                scene_number=len(scenes) + 1,
                            )
                        )
                    scenes[scene_index] = new_scene

                # Generate shots only for this specific scene
                script = await self.generate_shots(
                    script,
                    script.project_details.number_of_shots,
                    regenerate=True,
                    specific_chapter_index=chapter_index,
                    specific_scene_index=scene_index,
                )
                return script

            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing error: {str(e)}\nResponse: {response}")
                raise ValueError(f"Invalid JSON response: {str(e)}")
            except Exception as e:
                logger.error(f"Error processing scene data: {str(e)}")
                raise ValueError(f"Failed to process scene data: {str(e)}")

        except Exception as e:
            error_msg = f"Error regenerating scene: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg)

    async def regenerate_chapter(
        self,
        script: Script,
        chapter_index: int,
        custom_instructions: str | None = None,
        max_retries: int = 10,
    ) -> Script:
        """Regenerate a specific chapter while maintaining context."""
        prompt_template = await self._load_prompt(
            "single_chapter_generation_prompt.txt"
        )
        prev_error = "N/A"

        for attempt in range(max_retries):
            try:
                logger.info(
                    f"Regenerating chapter {chapter_index + 1} (attempt {attempt + 1}/{max_retries})"
                )
                prompt = await self._format_prompt(
                    prompt_template,
                    genre=script.project_details.genre,
                    subject=script.project_details.subject,
                    movie_general_instructions=script.project_details.movie_general_instructions,
                    story_background=script.project_details.story_background,
                    next_chapter_number=chapter_index + 1,
                    script=script,
                    regeneration_instructions=custom_instructions or "N/A",
                    previous_generation_error=prev_error,
                )

                response = await self.aws_service.invoke_llm(
                    prompt, prev_errors=prev_error
                )
                chapter_data = json.loads(response)["chapter"]
                new_chapter = Chapter(**chapter_data)
                new_chapter.chapter_number = chapter_index + 1

                # Update the chapter in the script
                script.chapters[chapter_index] = new_chapter
                return script

            except json.JSONDecodeError as e:
                prev_error = f"JSON Parse Error: {str(e)}"
                if attempt == max_retries - 1:
                    raise ValueError(f"Failed to parse chapter response: {str(e)}")
                logger.warning(
                    f"Failed to parse chapter response (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )
            except Exception as e:
                prev_error = f"Unexpected Error: {str(e)}"
                if attempt == max_retries - 1:
                    raise ValueError(f"Failed to regenerate chapter: {str(e)}")
                logger.warning(
                    f"Unexpected error regenerating chapter (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )

        raise ValueError(f"Failed to regenerate chapter after {max_retries} attempts")


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
