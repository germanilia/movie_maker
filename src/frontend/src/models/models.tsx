export interface Shot {
  reasoning?: string;
  shot_number: number;
  director_instructions: string;
  detailed_opening_scene_description?: string;
  detailed_closing_scene_description?: string;
  sound_effects?: string[] | string;
}

export interface Scene {
  reasoning?: string;
  scene_number: number;
  main_story: string | string[];
  narration_text: string;
  shots: Shot[] | null;
}

export interface Chapter {
  reasoning: string;
  chapter_number: number;
  chapter_title: string;
  chapter_description: string;
  scenes: Scene[] | null;
}

export interface Script {
  chapters: Chapter[];
}

export interface Image {
    url: string;
    chapter_index: number;
    scene_index: number;
    shot_index: number;
  }