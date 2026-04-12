import seedJson from "./seed.json";

export type UnitSystem = "metric";

export type ExerciseCategory =
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "arms"
  | "core";

export type Equipment =
  | "dumbbells"
  | "cable_machine"
  | "machine"
  | "bodyweight"
  | "roman_chair";

export type ExerciseDefault = {
  name: string;
  category: ExerciseCategory;
  equipment: Equipment;
  targetRepRange: string; // e.g. 8-12
};

export type ExerciseSet = {
  id: string;
  name: string;
  category: ExerciseCategory;
  weightKg: number;
  sets: number;
  reps: number;
  setDetails?: number[];
  weightNote?: string;
  totalReps?: number;
  source?: "confirmed" | "inferred" | "estimated";
};

export type WorkoutSession = {
  id: string;
  date: string; // yyyy-mm-dd
  title: string;
  source?: "confirmed" | "inferred" | "estimated";
  exercises: ExerciseSet[];
};

export type AscendSeed = {
  app: { name: string; version: string };
  meta: { unitSystem: UnitSystem; currency: string; notes: string[] };
  exerciseDefaults: ExerciseDefault[];
  workoutSessions: WorkoutSession[];
};

export const seed = seedJson as AscendSeed;

export const STORAGE_KEY = "ascend.v2";

export type PlannedExercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  weightKg: number;
  sets: number;
  targetReps: number; // per set target
};

export type PlannedWorkout = {
  id: string;
  date: string; // planned date (yyyy-mm-dd)
  title: string;
  exercises: PlannedExercise[];
  createdAt: number;
};

export type AscendState = {
  unitSystem: UnitSystem;
  workoutSessions: WorkoutSession[];
  plannedWorkout?: PlannedWorkout | null;
};

export function loadState(): AscendState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        unitSystem: parsed?.unitSystem ?? seed.meta.unitSystem,
        workoutSessions: Array.isArray(parsed?.workoutSessions) ? parsed.workoutSessions : seed.workoutSessions,
        plannedWorkout: parsed?.plannedWorkout ?? null,
      };
    }
  } catch {}
  return {
    unitSystem: seed.meta.unitSystem,
    workoutSessions: seed.workoutSessions,
    plannedWorkout: null,
  };
}

export function saveState(s: AscendState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}
