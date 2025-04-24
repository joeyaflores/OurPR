export interface Race {
  id: string; // Use string or number based on backend ID type (UUID is string)
  name: string;
  // Add fields directly, making them optional as they might be null in DB
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  date: string; // API returns date as string now
  distance?: '5K' | '10K' | 'Half Marathon' | 'Marathon' | '50K' | '50 Miles' | '100K' | '100 Miles' | 'Other'; // Updated with ultra distances
  total_elevation_gain?: number; // Added new numeric field
  website?: string;
  ai_summary?: string;
  pr_potential_score?: number;
  similar_runners_count?: number;
  training_groups_count?: number;
  similar_pace_runners_count?: number;
  image_url?: string | null;
  // Add other fields from Pydantic model if needed for type consistency
  flatness_score?: number;
  view_count?: number;
  save_count?: number;
  plan_count?: number;
  created_at?: string; // Dates from backend often come as ISO strings
  updated_at?: string;
} 