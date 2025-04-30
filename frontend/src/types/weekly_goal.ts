export interface WeeklyGoal {
  id: string; // UUID
  user_id: string; // UUID
  week_start_date: string; // ISO Date string (e.g., "2024-07-29")
  target_distance_meters?: number | null;
  target_duration_seconds?: number | null;
  target_workouts?: number | null;
  created_at: string; // ISO DateTime string
  updated_at: string; // ISO DateTime string
}

// Optional: Type for creating/updating if needed later
// export interface WeeklyGoalCreate {
//   week_start_date: string;
//   target_distance_meters?: number | null;
//   target_duration_seconds?: number | null;
//   target_workouts?: number | null;
// } 