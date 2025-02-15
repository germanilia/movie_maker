export interface ProjectDetails {
  project: string;
  topic: string;
  style: string;
  target_audience: string;
  duration_minutes: number;
  black_and_white: boolean;
}

export interface Shot {
  shot_number: number;
  director_instructions?: string;
  reasoning?: string;
  opening_frame?: string;
  closing_frame?: string;
}

export interface Scene {
  scene_number: number;
  description: string;
  narration: string;
  background_music?: string | string[];
  shots?: Shot[];
}

export interface Chapter {
  chapter_number: number;
  title: string;
  description: string;
  scenes?: Scene[];
}

export interface Script {
  project_details: ProjectDetails;
  chapters: Chapter[];
}

export interface NarrationResponse {
  status: string;
  narrations: Record<string, string>;
}