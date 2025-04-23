# Backend Implementation Summary (FastAPI)

This document summarizes the key features and components implemented for the OurPR FastAPI backend.

## Core Setup

-   **Project Structure:** Established the `backend/` directory with subdirectories: `app/`, `api/`, `models/`, `services/`, `utils/`, `supabase/`.
-   **FastAPI App:** Initialized the main FastAPI application in `backend/app/main.py` with basic configuration (title, description, version).
-   **Dependencies:** Created `backend/requirements.txt` including:
    -   `fastapi`
    -   `uvicorn[standard]`
    -   `supabase`
    -   `pydantic`
    -   `python-dotenv`
    -   `google-generativeai`
-   **Environment:** Provided placeholders for necessary environment variables (`SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`) in `backend/.env`.
-   **Git Ignore:** Configured `backend/.gitignore` for Python projects.

## Database & Services

-   **Supabase Schema:** Drafted the initial database schema for `races` and `user_prs` tables in `backend/supabase/schema.sql` (commented out).
-   **Supabase Client:** Implemented Supabase client initialization in `backend/app/services/supabase_client.py`, loading credentials from `.env`.
-   **Pydantic Models:** Defined data validation models for API requests/responses:
    -   `Race`, `RaceCreate`, `RaceUpdate` in `backend/app/models/race.py`.
    -   `UserPr`, `UserPrCreate`, `UserPrUpdate` in `backend/app/models/user_pr.py`.
    -   `UserRacePlan`, `UserRacePlanCreate` in `backend/app/models/user_race_plan.py`.

## API Endpoints & Authentication

-   **Authentication:** Implemented Supabase JWT validation as a FastAPI dependency (`get_current_user`) in `backend/app/api/auth.py`.
-   **Races Endpoint (`GET /api/races`):**
    -   Created in `backend/app/api/races.py`.
    -   Fetches a list of races from the Supabase `races` table.
    -   Supports filtering by `city`, `state`, `distance`, `flat_only`, `start_date`, `end_date`.
    -   Includes pagination (`skip`, `limit`).
    -   Uses the `Race` Pydantic model for the response.
-   **User PRs Endpoint (`GET /api/users/me/prs`):**
    -   Created in `backend/app/api/user_prs.py`.
    -   Requires authentication (uses `get_current_user`).
    -   Fetches personal records for the *authenticated* user from the `user_prs` table.
    -   Supports filtering by `distance`.
    -   Includes pagination and sorting.
    -   Uses the `UserPr` Pydantic model for the response.
-   **AI Race Query Endpoint (`POST /api/race-query/ai`):**
    -   Created in `backend/app/api/race_query.py`.
    -   Accepts a natural language query (`{"query": "..."}`).
    -   Uses the **Google Gemini API** (`gemini-1.5-flash`) via `google-generativeai` SDK to parse the query into structured filters (`ParsedFilters` model).
    -   Includes prompt engineering to request JSON output from Gemini.
    -   Queries the Supabase `races` table based on the extracted filters.
    -   Returns matching races using the `Race` model.
-   **User Race Plan Endpoints (`/api/users/me/plan`):**
    -   Created in `backend/app/api/user_plans.py`.
    -   Requires authentication for all operations.
    -   **`GET /`**: Fetches a list of `race_id` (UUIDs) for races currently in the authenticated user's plan.
    -   **`POST /`**: Adds a specified race (`race_id` in body) to the authenticated user's plan. Returns the created `UserRacePlan` record. Handles 409 conflict if the race is already in the plan.
    -   **`DELETE /{race_id}`**: Removes the specified race (path parameter `race_id`) from the authenticated user's plan. Returns 204 No Content on success. Handles 404 Not Found if the race is not in the plan.
-   **Routing:** All API routers (`races`, `user_prs`, `race_query`, `user_plans`) are correctly included in the main FastAPI application (`backend/app/main.py`) with appropriate prefixes and tags.

## Current Status

The core backend structure and primary read/query endpoints are implemented, including the AI-powered search functionality using Google Gemini. The backend server can be run using `uvicorn`. 