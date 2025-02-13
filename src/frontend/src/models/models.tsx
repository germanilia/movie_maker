export interface ProjectDetails {
  project: string;
  subject: string;
  style: string;
  genre: string;
  duration: string;
  age_rating: string;
  specific_requirements: string;
  black_and_white: boolean;
}

export interface Shot {
  shot_number: number;
  reasoning?: string;
  director_instructions?: string;
  detailed_opening_scene_description?: string;
  detailed_closing_scene_description?: string;
  sound_effects?: string[] | string;
}

export interface Scene {
  scene_number: number;
  main_story: string[] | string;
  reasoning?: string;
  narration_text: string;
  shots?: Shot[];
}

export interface Chapter {
  chapter_number: number;
  chapter_title: string;
  chapter_description: string;
  scenes?: Scene[];
}

export interface Script {
  chapters: Chapter[];
}