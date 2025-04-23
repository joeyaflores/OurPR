export interface Race {
  id: string | number; // Unique identifier
  name: string;
  location: {
    city: string;
    state: string; // Or country/region
    lat: number;   // Latitude
    lng: number;   // Longitude
  };
  date: string; // Consider using Date object later, string for simplicity now (e.g., "YYYY-MM-DD")
  distance: string; // e.g., "5K", "10K", "Half Marathon", "Marathon"
  elevation?: string; // e.g., "Flat", "Hilly", "Mixed"
  website?: string; // Optional link to race website
  // Add other fields as needed from the vision doc:
  // price?: number;
  // aiScore?: number;
  aiSummary?: string; // e.g., "This course is flat and fast. Weather is usually cool and dry."
  prPotentialScore?: number; // 1-10 scale
  similarRunnersCount?: number; // Count of similar runners who ran PRs (simpler than full list for now)
  trainingGroupsCount?: number; // "4 training groups already joined"
  similarPaceRunnersCount?: number; // "12 runners at your pace signed up"
  // similarPaceRunners?: number;
} 