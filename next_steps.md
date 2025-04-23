# Next Steps & Priorities

This document outlines potential next steps for the OurPR application based on the current state and project vision.

## Current State (High-Level)

*   **Core Discover UI:** Functional page with map, race list, basic filters, and AI insights display.
*   **Backend:** FastAPI server with endpoints for fetching races (`/api/races`), user PRs (`/api/users/me/prs`), AI race query (`/api/race-query/ai`), and managing user race plans (`/api/users/me/plan`).
*   **User Authentication:** Supabase auth integrated on frontend and backend.
*   **User Race Plan:** Fully implemented feature allowing users to add/remove races from their plan via the Discover page.
*   **AI Search:** Chat input connects to `POST /api/race-query/ai` via debounced requests.
*   **PR Timeline:** Component fetches and displays user PRs dynamically from `/api/users/me/prs`.
*   **Summaries:** `discover-page-summary.md` and `backend_summary.md` are up-to-date.

## Potential Next Steps (Discussion Points)

1.  **~~Integrate AI Search ("Search-as-Convo")~~ (Completed)**
    *   **Goal:** ~~Connect the `ChatSearchInput` component to the `POST /api/race-query/ai` backend endpoint.~~
    *   **Impact:** ~~Fulfills a core vision item, enabling natural language race searching. High user value.~~
    *   **Effort:** ~~Medium. Requires frontend logic changes in `ChatSearchInput` (and potentially parent page) to handle API calls, loading states, and displaying results based on the AI endpoint's response. Backend endpoint is already built.~~
    *   **Priority:** ~~High.~~

2.  **~~Make PR Timeline Dynamic~~ (Completed)**
    *   **Goal:** ~~Connect the `PRTimeline` component to the `GET /api/users/me/prs` endpoint.~~
    *   **Impact:** ~~Adds personalization for logged-in users, showing their actual PRs. Leverages existing backend endpoint.~~
    *   **Effort:** ~~Low-Medium. Requires frontend logic in `PRTimeline.tsx` to fetch and display user PR data. Component structure exists.~~
    *   **Priority:** ~~High.~~

3.  **Implement "Real" Smart Filters**
    *   **Goal:** Add backend logic and data support for filters like "Trending races near me" and "Popular among similar runners".
    *   **Impact:** Enhances discovery with powerful, personalized filtering options. Aligns with vision.
    *   **Effort:** High. Requires significant backend work (defining metrics, potential data processing, complex queries) and frontend integration. May depend on having more user data.
    *   **Priority:** High.

4.  **Refine Race Insights & Display**
    *   **Goal:** Review and improve how race data (especially AI insights, elevation, etc.) is presented on cards and map popups. Potentially add more data points like course maps if available.
    *   **Impact:** Improves clarity and usefulness of displayed race information.
    *   **Effort:** Low-Medium. Mostly frontend UI tweaks unless new data fetching is required on the backend.
    *   **Priority:** Medium. Can be done incrementally.

## Suggested Prioritization

1.  **~~AI Search Integration: High impact, core feature, backend ready.~~**
2.  **~~Dynamic PR Timeline: Good personalization, leverages existing backend, relatively straightforward frontend work.~~**
1.  **Implement Smart Filters:** Highest effort, potentially dependent on other features/data.
2.  **Refine Race Insights:** Incremental improvements to existing features.

This order aims for high-impact features first while leveraging existing backend components where possible. 