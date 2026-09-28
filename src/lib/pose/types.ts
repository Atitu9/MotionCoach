export type Exercise = "squat" | "lunge" | "jumpingJack";
export type WorkoutStage =
  | "landing"
  | "camera_permission"
  | "camera_setup"
  | "ready"
  | "countdown"
  | "squat"
  | "transition"
  | "lunge"
  | "jumpingJack"
  | "complete"
  | "results";

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export type Landmarks = Landmark[];

export interface FormError {
  id: string;
  exercise: Exercise;
  severity: "info" | "warning" | "critical";
  message: string;
  joints: number[];
  timestamp: number;
  confidence: number;
  priority: number;
}

export interface RepResult {
  exercise: Exercise;
  repNumber: number;
  valid: boolean;
  quality: number;
  errors: FormError[];
  timestamp: number;
}

export interface Analysis {
  phase: string;
  cue: string;
  errors: FormError[];
  attempt?: { valid: boolean; quality: number; errors: FormError[] };
  debug: Record<string, string | number>;
}

export interface WorkoutSnapshot {
  stage: WorkoutStage;
  exercise: Exercise | null;
  nextExercise: Exercise | null;
  phase: string;
  cue: string;
  primaryError: FormError | null;
  counts: Record<Exercise, number>;
  targets: Record<Exercise, number>;
  reps: RepResult[];
  score: number;
  formScore: number;
  elapsedMs: number;
  secondsRemaining: number;
  setupMessage: string;
  setupProgress: number;
  gestureProgress: number;
  tracking: boolean;
  debug: Record<string, string | number>;
  event: "rep" | "round" | "complete" | "warning" | null;
}

export const POSE = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;
