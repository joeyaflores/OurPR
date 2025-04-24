import { createClient } from './supabase/client'; // Use the browser client

// --- Base URL for the Backend API ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'; // Default to localhost:8000 if not set

// --- Type Definitions (Align with Backend Pydantic Models) ---
// TODO: Consider sharing types between backend and frontend (e.g., via a shared package)

export interface UserGoalPayload {
  goal_race_name?: string | null;
  goal_race_date?: string | null; // YYYY-MM-DD format
  goal_distance?: string | null;
  goal_time?: string | null; // HH:MM:SS format
}

export interface Race {
  id: string; // uuid
  name: string;
  city?: string | null;
  state?: string | null;
  distance?: string | null;
  date?: string | null; // <<< Change race_date to date >>>
  website_url?: string | null;
  flatness_score?: number | null;
  average_temp_fahrenheit?: number | null;
  historical_pr_rate?: number | null; // <<< Check if this is still used, or replaced by pr_potential_score
  pr_potential_score?: number | null; // <<< Add based on model
  lat?: number | null; // <<< Add based on model
  lng?: number | null; // <<< Add based on model
  ai_summary?: string | null; // <<< Add based on model
  total_elevation_gain?: number | null; // <<< Add based on model
  similar_runners_count?: number | null; // <<< Add based on model
  training_groups_count?: number | null; // <<< Add based on model
  similar_pace_runners_count?: number | null; // <<< Add based on model
  view_count?: number; // <<< Add based on model
  save_count?: number; // <<< Add based on model
  plan_count?: number; // <<< Add based on model
  // Add other fields returned by the backend Race model as needed
}

// Geolocation Coordinates Type (can be reused)
interface Coordinates {
  latitude: number;
  longitude: number;
}

// --- API Fetch Utility ---

async function fetchApi(path: string, options: RequestInit = {}) {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    // Handle unauthenticated state - maybe redirect or throw specific error
    throw new Error('User is not authenticated.');
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE_URL}${path}`, config);

  if (!response.ok) {
    // Attempt to parse error details from backend
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // Ignore if response is not JSON
    }
    const errorMessage = errorData?.detail || `API Error: ${response.status} ${response.statusText}`;
    console.error("API Error:", errorMessage, "Path:", path, "Status:", response.status);
    throw new Error(errorMessage);
  }

  // Handle responses with no content (e.g., 204 No Content)
  if (response.status === 204) {
      return null;
  }

  // Assume JSON response otherwise
  try {
      return await response.json();
  } catch (error) {
      console.error("Failed to parse API response as JSON:", error);
      throw new Error("Failed to parse API response.");
  }
}

// --- Specific API Functions ---

/**
 * Creates or updates the user's goal via the backend API.
 * @param goalData - The goal data to save.
 */
export async function createOrUpdateUserGoal(goalData: UserGoalPayload): Promise<any> { // TODO: Define UserGoal response type
  return fetchApi('/users/me/goal/', {
    method: 'POST',
    body: JSON.stringify(goalData),
  });
}

/**
 * Fetches recommended races for the authenticated user.
 * @param coords - Optional user coordinates { latitude, longitude }.
 */
export async function getRecommendedRaces(coords?: Coordinates | null): Promise<Race[]> {
  let path = '/users/me/recommended-races/';

  // Append coordinates as query parameters if provided
  if (coords) {
    const params = new URLSearchParams();
    params.append('latitude', coords.latitude.toString());
    params.append('longitude', coords.longitude.toString());
    path += `?${params.toString()}`;
    console.log("Requesting recommendations with path:", path);
  } else {
      // Ensure path still includes trailing slash even without params
      path = '/users/me/recommended-races/';
  }

  const result = await fetchApi(path, {
    method: 'GET',
  });
  // Ensure the result is an array, default to empty array if not
  return Array.isArray(result) ? result : [];
} 