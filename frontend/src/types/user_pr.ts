import type { Race } from './race'; // Potentially link back to Race type

// Type definition based on backend/app/models/user_pr.py
export interface UserPr {
  id: string; // UUID comes as string
  user_id: string; // UUID comes as string
  race_id?: string | null; // Optional UUID string or null
  distance: string;
  date: string; // Date string (e.g., "YYYY-MM-DD") from API
  time_in_seconds: number;
  created_at: string; // Timestamp string (ISO 8601) from API

  // Optional: If backend populates related race info
  // race?: Race | null; 
} 