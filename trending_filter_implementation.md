# Implementation Plan: "Trending Races Near Me" Filter

This document outlines the steps required to implement the "Trending races near me" filter on the Discover page.

## 1. Objective

Allow users to filter races shown on the Discover page to prioritize races that are currently "trending" within a certain distance of their current location.

## 2. Definitions

*   **Trending:** For the initial implementation (V1), a race is considered "trending" based on how many users have added it to their plan (`user_race_plans` table) within a recent timeframe (e.g., the last 30 days). Races will be ordered by this count (descending).
*   **Near Me:** Within a specified radius (e.g., 100 miles) of the user's current geographic location. This location will be obtained temporarily via the browser's Geolocation API *only when* the user activates the filter. It will not be stored persistently on the backend for V1.

## 3. Backend Changes

**Target File:** `backend/app/api/races.py` (Modify `GET /api/races` endpoint)

*   **Existing Context:** The endpoint currently accepts `city`, `state`, `distance`, `flat_only`, `start_date`, `end_date`, `skip`, `limit` and builds a query using the Supabase client.
*   **Add Optional Query Parameters:**
    *   `trending: bool = False`
    *   `lat: Optional[float] = None`
    *   `lng: Optional[float] = None`
    *   `radius_miles: Optional[int] = None` (Default radius, e.g., 100 miles, can be applied if lat/lng are present but radius is not)
*   **Query Logic Modification (RPC Approach Recommended):**
    *   **Recommendation:** Due to the complexity of combining geospatial filtering, joining with `user_race_plans`, counting recent additions, and ordering, it's strongly recommended to encapsulate this logic within a **Supabase Database Function (RPC)**.
    *   **Proposed RPC Function Signature (Example):** `get_filtered_races(base_filters jsonb, apply_trending boolean, user_lat double precision, user_lng double precision, radius_miles integer, trend_days integer, result_limit integer, result_offset integer)`
        *   `base_filters`: A JSON object containing the standard filters (distance, date, flat_only, etc.) passed from the API.
        *   The function would internally apply `base_filters`, then optionally apply distance filtering using `ST_DWithin` if `user_lat`/`user_lng` are provided, then optionally calculate trending scores (recent plan additions within `trend_days`) and order by score if `apply_trending` is true. Finally applies limit/offset.
    *   **API Endpoint Logic:** The FastAPI endpoint (`GET /api/races`) will parse its query parameters (`distance`, `date`, `flat_only`, `trending`, `lat`, `lng`, `radius_miles`, `skip`, `limit`). It will construct the `base_filters` JSON object and call the Supabase RPC function (e.g., `supabase.rpc('get_filtered_races', {...})`) with the appropriate arguments. This keeps the Python code cleaner.
    *   **Filter Interaction:** The RPC function should apply the `base_filters` (distance, date range, etc.) first, then apply location filtering (if requested), and finally apply trending logic (if requested) to the results of the previous steps.
    *   **Fallback:** If `trending=True` is requested but `lat`/`lng` are *not* provided by the frontend, the API should call the RPC with `user_lat=None`, `user_lng=None`. The RPC function should handle this by skipping the distance filter and applying trending logic globally (based on recent plan adds across all users).
*   **Error Handling:** Handle potential errors related to invalid coordinates passed to the RPC or errors raised by the RPC function itself.

## 4. Frontend Changes

**Target Files:** `frontend/src/app/discover/page.tsx`, `frontend/src/components/discover/FilterSidebar.tsx`

*   **State (`DiscoverPage.tsx`):**
    *   Add state variables for user's location: `userLatitude: number | null`, `userLongitude: number | null`.
    *   Add state for location fetch status: `locationStatus: 'idle' | 'loading' | 'success' | 'error'`.
*   **Filter Sidebar (`FilterSidebar.tsx`):**
    *   Locate the "Trending races near me" checkbox.
    *   Ensure `onCheckedChange` calls the `onTrendingChange` prop.
    *   **(New in `DiscoverPage.tsx`)** Modify the `onTrendingChange` handler passed down:
        *   If the checkbox is being *checked*: Call `fetchUserLocation()` first. Only update the `showTrending` state to `true` *after* the location attempt (whether success or error).
        *   If the checkbox is being *unchecked*: Set `showTrending` state to `false` and clear location state (`userLatitude`, `userLongitude`, `locationStatus`).
*   **Location Fetching (`DiscoverPage.tsx`):
    *   Create a new function `fetchUserLocation() async`.
    *   Inside `fetchUserLocation()`:
        *   Check `navigator.geolocation`.
        *   Set `locationStatus` to `'loading'`. Show subtle loading indicator near the checkbox.
        *   Use `new Promise(...)` wrapper around `navigator.geolocation.getCurrentPosition` to make it awaitable.
        *   On Success: Update state (`userLatitude`, `userLongitude`), set `locationStatus` to `'success'`. Resolve the promise.
        *   On Error: Set `locationStatus` to `'error'`. Show toast: "Could not get location. Enable location services or grant permission to see trending races near you. Showing global trending races instead." Clear location state. Resolve the promise (or reject if fetch should be blocked).
        *   Add a brief explanation near the checkbox (e.g., using a tooltip) explaining why location is requested.
*   **API Call (`DiscoverPage.tsx`):
    *   Modify `fetchFilteredRaces` (or the `useEffect` calling it).
    *   The function should now be triggered whenever `showTrending`, `userLatitude`, `userLongitude`, or other filters change.
    *   Construct the query parameters for `GET /api/races`:
        *   Include standard filters (distance, date, flat_only).
        *   If `showTrending` is true:
            *   Add `trending=true`.
            *   If `locationStatus === 'success'` and `userLatitude`, `userLongitude` exist: Add `lat=userLatitude`, `lng=userLongitude`, `radius_miles=100`.
            *   (Fallback to global trending is handled by the backend if lat/lng are missing when `trending=true`).
    *   Ensure UI reflects the state (e.g., disable checkbox while `locationStatus === 'loading'`).

## 5. Database Changes (Supabase)

*   **Prerequisite Check:** Verify that `latitude` and `longitude` (or equivalent) columns exist on the `races` table.
*   **Enable PostGIS:** Run `CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;` (Specify schema for Supabase).
*   **Add Geometry Column:** `ALTER TABLE public.races ADD COLUMN location extensions.geometry(Point, 4326);`
*   **Populate Geometry Column:** `UPDATE public.races SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;` (Adjust column names if different).
*   **Create Spatial Index:** `CREATE INDEX races_location_idx ON public.races USING gist (location);`
*   **Create RPC Function:** Define the `get_filtered_races` function in SQL. This will involve:
    *   Accepting parameters as defined in Backend section.
    *   Applying basic filters from `base_filters` JSON.
    *   Applying `ST_DWithin(location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326), radius_miles * 1609.34)` if location parameters are provided (converting miles to meters).
    *   Joining with `user_race_plans`, filtering by `created_at >= now() - interval '...'`, grouping by race, and counting if `apply_trending` is true.
    *   Implementing the correct `ORDER BY` logic (trending count desc, then maybe date asc).
    *   Applying `LIMIT` and `OFFSET`.
    *   Returning the set of `races`.

## 6. Implementation Order

1.  **Database:** Verify prerequisite columns. Enable PostGIS, add/populate geometry column, create index.
2.  **Database:** Define and test the `get_filtered_races` RPC function in Supabase SQL editor.
3.  **Backend:** Update `GET /api/races` endpoint to parse parameters and call the new RPC function. Test API endpoint directly.
4.  **Frontend:** Implement geolocation fetching (`fetchUserLocation`), state management (`userLatitude`, `locationStatus`), and UI feedback (loading, errors, tooltips) in `DiscoverPage` and `FilterSidebar`.
5.  **Frontend:** Update `fetchFilteredRaces` to pass the new parameters (`trending`, `lat`, `lng`, `radius_miles`) based on state.
6.  **Testing:** Thoroughly test different scenarios (filter on/off, location allowed/denied, combinations with other filters, empty results, errors).

This provides a structured approach, starting with the necessary database and backend foundations before integrating with the frontend. 