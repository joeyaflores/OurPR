# Discover Page UI Implementation Summary

This document summarizes the frontend development work completed for the OurPR Discover page based on the provided vision document.

## Core Objective Achieved (Initial Version)

- A functional Discover page (`src/app/discover/page.tsx`) was created using Next.js and React.
- The page displays races on an interactive map and in a results list, allowing users to visually explore options.
- Filters allow users to narrow down races based on various criteria.

## Key Features Implemented

1.  **Modular Component Structure:**
    *   Created dedicated components for major sections:
        *   `ChatSearchInput`
        *   `MapView` (and `ClientMapWrapper` for dynamic loading)
        *   `FilterSidebar`
        *   `RaceResults`
        *   `PRTimeline`
    *   Established a `src/components/discover/` directory.

2.  **Map-First UI (`MapView.tsx`):
    *   Integrated `react-leaflet` for an interactive map.
    *   Successfully handled Next.js SSR compatibility issues using `next/dynamic`.
    *   Resolved Leaflet icon loading issues.
    *   Populated the map with markers based on mock race data.
    *   Popups display race details when markers are clicked.

3.  **Smart Filters Sidebar (`FilterSidebar.tsx`):
    *   State for filters (distance, flatness, date range, trending, popular) is managed in the parent `DiscoverPage`.
    *   Implemented filter UI using ShadCN components (`Select`, `Checkbox`, `Label`, `Popover`, `Calendar`, `Button`).
    *   Implemented filtering logic in `DiscoverPage` based on selected criteria (using `useMemo`).
    *   Includes functional filters for:
        *   Distance
        *   "Show flat courses only"
        *   Date Range
    *   Includes UI and placeholder logic/sorting for:
        *   "Trending races near me"
        *   "Popular among similar runners"
    *   Addressed peer dependency conflicts with React 19 for `react-day-picker` and `lucide-react` using `--legacy-peer-deps`.

4.  **Race Results List (`RaceResults.tsx`):
    *   Displays race data in individual cards using ShadCN `Card` components.
    *   Dynamically updates based on selected filters and search query.
    *   **Implemented Add/Remove Plan Button:**
        *   Fetches the user's current race plan (`GET /api/users/me/plan/`) on load if logged in.
        *   Displays a button on each race card: "Add to Plan" (outline variant) or "Remove from Plan" (destructive variant) based on whether the race is in the fetched plan.
        *   Button is disabled if the user is not logged in or during loading/API calls.
        *   Clicking "Add" calls `POST /api/users/me/plan/`.
        *   Clicking "Remove" calls `DELETE /api/users/me/plan/{race_id}`.
        *   Uses optimistic UI updates (updates local state immediately) for a faster feel.
        *   Provides user feedback via `sonner` toast notifications for success (Add/Remove) and errors (e.g., already in plan, not found, API errors).

5.  **AI Race Insight Cards & Popups:**
    *   Extended the `Race` type (`src/types/race.ts`) to include fields like `aiSummary`, `prPotentialScore`, `similarRunnersCount`, etc.
    *   Updated mock data to include these fields.
    *   Displayed these insights on both `RaceResults` cards and `MapView` marker popups, using icons (`lucide-react`) and badges (`shadcn/ui`) for better presentation.

6.  **Search-as-Convo Input (`ChatSearchInput.tsx`):
    *   Implemented a search input using ShadCN `Input`.
    *   Added basic text filtering logic (name, city, state) in `DiscoverPage`.
    *   Implemented debouncing using a custom `useDebounce` hook (`src/hooks/useDebounce.ts`) for performance.
    *   Added minor styling refinement (search icon).

7.  **Your PR Timeline (`PRTimeline.tsx`):
    *   Fetches and displays the logged-in user's personal records from the `GET /api/users/me/prs` endpoint.
    *   Handles loading, error, and logged-out states.
    *   Provides **Add/Edit/Delete PR functionality**:
        *   Displays an "Add New PR" card/button.
        *   Clicking "Add New PR" or the "View/Edit Details" button on an existing PR card opens a `Dialog`.
        *   Uses a dedicated `AddEditPrForm.tsx` component within the `Dialog`, utilizing `react-hook-form` and `zod` for validation.
        *   The form handles both creating new PRs (`POST /api/users/me/prs`) and updating existing ones (`PUT /api/users/me/prs/{pr_id}`).
        *   Includes a confirmation step for deleting PRs (`DELETE /api/users/me/prs/{pr_id}`).
        *   Provides user feedback via `sonner` toast notifications for success and errors during API calls.
        *   Refreshes the PR list automatically after successful operations.

8.  **Map/List Interactivity:**
    *   Hovering a race card highlights the corresponding map marker.
    *   Clicking a race card pans/zooms the map (`flyTo`) and opens the marker popup.
    *   Clicking a map marker highlights the corresponding race card in the list.

## Technology Stack Used

*   Next.js (React Framework)
*   React (including Hooks: `useState`, `useMemo`, `useEffect`)
*   TypeScript
*   Tailwind CSS
*   ShadCN/ui (for UI components like Card, Select, Checkbox, Calendar, etc.)
*   React Leaflet & Leaflet.js (for map integration)
*   date-fns (for date manipulation)
*   Lucide React (for icons)

## Current State & Next Steps

The frontend UI structure and core functionality are largely complete based on the vision.

Key next steps involve **backend integration**:

*   Replacing mock data (`MOCK_RACES`) with data fetched from an API.
*   Connecting the Chat Search input to the specified AI backend endpoint (`/race-query/ai`).
*   Implementing the actual logic for "Trending" and "Popular" filters (likely requiring backend data/logic).
*   Making the PR Timeline dynamic based on user data **(Completed)**.
*   Implementing the "Add to Plan" functionality (backend storage) **(Completed)**.
*   Implementing Add/Edit/Delete functionality for User PRs **(Completed)**. 