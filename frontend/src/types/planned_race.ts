import type { Race } from './race'; // Import the base Race type

// Corresponds to the PlannedRaceDetail Pydantic model in the backend
export interface PlannedRaceDetail extends Race {
  user_race_plan_id: string; // UUID represented as string in TS
  has_generated_plan: boolean;
} 