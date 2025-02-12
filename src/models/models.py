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
    still_image: bool | str  = False
    shot_director_instructions: str
    detailed_opening_scene_description: str | None = None
    detailed_closing_scene_description: str | None = None


class Scene(BaseModel):
    scene_number: int = -1
    general_scene_description_and_motivations: str
    key_events: List[str]
    main_characters: List[str]
    narration_text: str
    shots: List[Shot] | None = None
    sound_effects: List[str] | str


class Chapter(BaseModel):
    chapter_number: int
    chapter_title: str
    chapter_description: str
    key_events: List[str]
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
    custom_prompt: str | None = None
