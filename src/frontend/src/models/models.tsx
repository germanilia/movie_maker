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
  reasoning: string;
  director_instructions?: string;
  opening_frame: string;
}

export interface Scene {
  scene_number: number;
  main_story: string[] | string;
  reasoning: string;
  narration_text: string;
  shots?: Shot[];
  background_music: string[] | string;
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

export interface NarrationResponse {
  status: string;
  narrations: Record<string, boolean>;
}