# Implementation Plan: "Trending Races Near Me" Filter

This document outlines the steps required to implement the "Trending races near me" filter on the Discover page.

## 1. Objective

Allow users to filter races shown on the Discover page to prioritize races that are currently "trending" within a certain distance of their current location.

## 2. Definitions

*   **Trending:** For the initial implementation (V1), a race is considered "trending" based on how many users have added it to their plan (`user_race_plans` table) within a recent timeframe (e.g., the last 30 days). Races will be ordered by this count (descending).
*   **Near Me:** Within a specified radius (e.g., 100 miles) of the user's current geographic location. This location will be obtained temporarily via the browser's Geolocation API *only when* the user activates the filter. It will not be stored persistently on the backend for V1.

## 3. Backend Changes

**Target File:** `backend/app/api/races.py` (Modify `GET /api/races` endpoint)

*   **Add Optional Query Parameters:**
    *   `trending: bool = False`
    *   `lat: Optional[float] = None`
    *   `lng: Optional[float] = None`
    *   `radius_miles: Optional[int] = None` (Default radius, e.g., 100 miles, can be applied if lat/lng are present but radius is not)
*   **Query Logic Modification:**
    *   **If `lat`, `lng`, `radius_miles` are provided:**
        *   Add a geospatial filter to the main Supabase query. This requires the `postgis` extension to be enabled and the `races` table to have an indexed `geometry` column.
        *   Use a function like `ST_DWithin` to find races within the specified radius of the point defined by `lat` and `lng`.
        *   Example filter concept (syntax might vary): `.filter('location', 'cs', f'POINT({lng} {lat})')` combined with a distance function or RPC call. *Need to confirm exact Supabase/PostgREST syntax for ST_DWithin.*
    *   **If `trending=True`:**
        *   The query needs to join `races` with `user_race_plans`.
        *   Filter `user_race_plans` entries to those created within the last 30 days.
        *   Group by `race.id` and count the number of recent plan additions (`plan_count`).
        *   Order the results primarily by `plan_count` (descending), potentially with a secondary sort (e.g., date).
        *   **Complexity Note:** This might be complex for a single Supabase query builder chain. Consider creating a **Supabase Database Function (RPC)** (e.g., `get_trending_races(latitude, longitude, radius_mi, time_period_days)`) that encapsulates this logic (counting recent plans, applying distance filter) and returns the ordered list of race IDs or full race objects. The API endpoint would then call this RPC.
*   **Error Handling:** Handle potential errors related to invalid coordinates or database function calls.

## 4. Frontend Changes

**Target Files:** `frontend/src/app/discover/page.tsx`, `frontend/src/components/discover/FilterSidebar.tsx`

*   **State (`DiscoverPage.tsx`):**
    *   Add state variables for user's location: `userLatitude: number | null`, `userLongitude: number | null`.
    *   Add state for location fetch status: `locationStatus: 'idle' | 'loading' | 'success' | 'error'`.
*   **Filter Sidebar (`FilterSidebar.tsx`):**
    *   Locate the "Trending races near me" checkbox.
    *   Modify its `onCheckedChange` (or equivalent) handler (`onTrendingChange` prop passed from parent):
        *   When checked:
            *   Trigger a function (passed via props from `DiscoverPage`) to get the user's location.
        *   When unchecked:
            *   Trigger a function to clear the location state in `DiscoverPage`.
*   **Location Fetching (`DiscoverPage.tsx`):**
    *   Create a new function `fetchUserLocation()`.
    *   Inside `fetchUserLocation()`:
        *   Check if `navigator.geolocation` is available.
        *   Set `locationStatus` to `'loading'`.
        *   Call `navigator.geolocation.getCurrentPosition(successCallback, errorCallback)`.
        *   `successCallback`: Updates `userLatitude`, `userLongitude` state, set `locationStatus` to `'success'`.
        *   `errorCallback`: Handles errors (permission denied, unavailable, timeout), sets `locationStatus` to `'error'`, shows a user-friendly toast message (e.g., "Could not get location. Showing global trending races instead?"), potentially clears location state.
*   **API Call (`DiscoverPage.tsx`):**
    *   Modify the primary data fetching logic (`useEffect` hook or dedicated fetch function like `fetchFilteredRaces`).
    *   Check the state of the "Trending" checkbox (`showTrending` state).
    *   If `showTrending` is true:
        *   If `userLatitude` and `userLongitude` are available: Pass `trending=true`, `lat=userLatitude`, `lng=userLongitude`, `radius_miles=100` (or other default) to the `GET /api/races` endpoint.
        *   If location is *not* available (e.g., permission denied): Decide fallback. Option A: Pass only `trending=true` (show global trending). Option B: Show an error/message and don't apply the filter. *Let's start with Option A (global trending) for simplicity.*
    *   Ensure the fetch logic re-runs when `showTrending`, `userLatitude`, or `userLongitude` change.

## 5. Database Changes (Supabase)

*   **Enable PostGIS:** Run `CREATE EXTENSION IF NOT EXISTS postgis;` in the Supabase SQL editor.
*   **Add Geometry Column:** Add a column to the `races` table: `ALTER TABLE races ADD COLUMN location geometry(Point, 4326);` (SRID 4326 is standard for GPS coordinates).
*   **Populate Geometry Column:** Create a function and trigger *or* run a one-time script to populate the new `location` column from existing `lat` and `lng` columns: `UPDATE races SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE lat IS NOT NULL AND lng IS NOT NULL;`
*   **Create Spatial Index:** Create an index for efficient location-based queries: `CREATE INDEX races_location_idx ON races USING gist (location);`
*   **Consider RPC for Trending Logic:** As mentioned in Backend Changes, evaluate if a dedicated database function is needed for calculating recent plan counts efficiently, especially if combining with distance filtering.

## 6. Implementation Order

1.  **Database:** Enable PostGIS, add/populate geometry column, create index.
2.  **Backend:** Update API endpoint (`/api/races`) to accept new parameters and implement *distance filtering* using `ST_DWithin` (or equivalent). Test this first.
3.  **Backend:** Implement V1 *trending logic* (counting recent plans, ordering). Decide if RPC is needed. Test separately.
4.  **Frontend:** Implement geolocation fetching and state management in `DiscoverPage` and `FilterSidebar`.
5.  **Frontend:** Update API call logic to pass new parameters based on filter state and location availability.
6.  **Testing:** Thoroughly test different scenarios (filter on/off, location allowed/denied, combinations with other filters).

This provides a structured approach, starting with the necessary database and backend foundations before integrating with the frontend. 