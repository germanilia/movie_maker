from pydantic import BaseModel
from typing import List

class ProjectDetails(BaseModel):
    project: str
    genre: str
    subject: str
    movie_general_instructions: str
    narration_instructions: str
    story_background: str
    number_of_chapters: int
    number_of_scenes: int
    number_of_shots: int
    black_and_white: bool


class Shot(BaseModel):
    reasoning: str | None = None
    shot_number: int = -1
    director_instructions: str = ""  # Changed to have a default empty string
    opening_frame: str | None = None

class Scene(BaseModel):
    reasoning: str | None = None
    scene_number: int = -1
    main_story: str | List[str]
    narration_text: str
    shots: List[Shot] | None = None
    background_music: List[str] | str | None = None
    
class Chapter(BaseModel):
    reasoning:str
    chapter_number: int | None = None
    chapter_title: str
    chapter_description: str
    scenes: List[Scene] | None = None
class Script(BaseModel):
    chapters: List[Chapter]
    project_details: ProjectDetails


class ReviewedScript(BaseModel):
    scenes: List[Scene]


class RegenerateImageRequest(BaseModel):
    chapter_index: int
    scene_index: int
    shot_index: int
    type: str
    custom_prompt: str | None = None
    overwrite_image: bool = False
    model_type: str = "flux_ultra_model"
    reference_image: str | None = None
    seed: int = 333

