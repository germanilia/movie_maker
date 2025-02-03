from pydantic import BaseModel
from typing import List


class VideoRequest(BaseModel):
    project: str
    genre: str
    subject: str
    special_instructions: str
    story_background: str
    main_character_description: str = "N/A"
    number_of_chapters: int
    number_of_scenes: int
    number_of_shots: int
    black_and_white: bool


class Shot(BaseModel):
    shot_number: int = -1
    still_image: bool | str
    detailed_opening_scene_description: str
    detailed_opening_scene_description_main_character_presence: bool | str
    detailed_closing_scene_description: str
    detailed_closing_scene_description_main_character_presence: bool | str
    detailed_shot_description: str


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
    main_characters: List[str]
    scenes: List[Scene] | None = None


class Script(BaseModel):
    chapters: List[Chapter]


class ReviewedScript(BaseModel):
    scenes: List[Scene]


class RegenerateImageRequest(BaseModel):
    chapter_index: int
    scene_index: int
    shot_index: int
    custom_prompt: str | None = None
