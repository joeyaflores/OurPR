// frontend/src/types/workout.ts
// Corresponds to backend/app/models/workout.py

export type ActivityType = 'run' | 'bike' | 'swim' | 'walk' | 'other';

export interface Workout {
  id: string; // UUID
  user_id: string; // UUID
  date: string; // ISO Date string (YYYY-MM-DD)
  distance_meters?: number | null;
  duration_seconds?: number | null;
  activity_type: ActivityType;
  notes?: string | null;
  effort_level?: number | null; // 1-5
  created_at: string; // ISO DateTime string
  updated_at: string; // ISO DateTime string
}

// NEW: Type for the payload sent TO the API
export interface WorkoutPayload {
  date: string; // YYYY-MM-DD
  activity_type: ActivityType;
  distance_meters: number | null;
  duration_seconds: number | null;
  notes: string | null;
  effort_level: number | null; // 1-5 or null
}

// Optional: Type for form data if it differs significantly
// export interface WorkoutFormData { ... } 