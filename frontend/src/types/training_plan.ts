export interface WeeklySummary {
    week_number: number;
    summary: string;
    estimated_weekly_mileage?: string | null;
}

export interface TrainingPlanOutline {
    race_name: string;
    race_distance: string;
    total_weeks: number;
    weeks: WeeklySummary[];
    notes?: string[] | null;
}

// --- Detailed Daily Plan Structures ---

// Represents a single day's activity within the training plan
export interface DailyWorkout {
  date: string; // ISO 8601 Format: "YYYY-MM-DD"
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  workout_type: 'Easy Run' | 'Tempo Run' | 'Intervals' | 'Speed Work' | 'Long Run' | 'Rest' | 'Cross-Training' | 'Strength' | 'Race Pace' | 'Warm-up' | 'Cool-down' | 'Other';
  description: string; // Primary instruction, e.g., "5 miles at conversational pace", "Rest day", "30 min cycling"
  distance?: string; // Optional: e.g., "5 miles", "10 km"
  duration?: string; // Optional: e.g., "45 minutes", "1:30:00"
  intensity?: string; // Optional: e.g., "Easy", "Tempo", "Hard", "Conversational", "HR Zone 2"
  notes?: string[]; // Optional: Array of additional tips, instructions, or variations
  status: 'pending' | 'completed' | 'skipped'; // Status for user tracking
}

// Represents a single week within the training plan
export interface DetailedWeek {
  week_number: number; // Relative to the plan (1 to total_weeks)
  start_date: string; // "YYYY-MM-DD" of the Monday of this week
  end_date: string; // "YYYY-MM-DD" of the Sunday of this week
  days: DailyWorkout[]; // Array of 7 DailyWorkout objects for the week
  weekly_focus?: string; // Optional: A short summary of the week's goal
  estimated_weekly_mileage?: string; // e.g., "35-40 miles"
}

// Represents the overall detailed training plan
export interface DetailedTrainingPlan {
  plan_id: string; // Unique identifier for the plan instance
  user_id: string; // Identifier for the user this plan belongs to
  race_name: string;
  race_distance: string;
  race_date: string; // "YYYY-MM-DD"
  goal_time?: string; // Optional user goal
  plan_start_date: string; // "YYYY-MM-DD" - First Monday of the plan
  total_weeks: number;
  weeks: DetailedWeek[]; // The core daily schedule
  overall_notes?: string[]; // General notes from the coach/system for the whole plan
  personalization_details?: {
      pr_used?: string; // e.g., "5K PR: 25:30"
      adjustments_made?: string[]; // e.g., ["Reduced initial long run based on recent activity"]
  };
  generated_at: string; // ISO timestamp
  plan_version: string; // e.g., "v2.0-daily"
} 