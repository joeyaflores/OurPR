# backend/app/api/weekly_goals.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Annotated, Optional, List
from datetime import date, timedelta
import uuid

from ..models.weekly_goal import WeeklyGoal, WeeklyGoalCreate, WeeklyGoalUpdate # Assuming Update might be needed later, keep for now
from .auth import get_current_user
from ..services.supabase_client import get_supabase_client
from gotrue.types import User as SupabaseUser
from postgrest import SyncPostgrestClient

# Define type hints using Annotated
CurrentUser = Annotated[SupabaseUser, Depends(get_current_user)]
AuthedSupabaseClient = Annotated[SyncPostgrestClient, Depends(get_supabase_client)]

router = APIRouter(
    prefix="/users/me/weekly-goal",
    tags=["Weekly Goals"],
    # responses={404: {"description": "Not found"}}, # Optional: Define common responses
)

def get_current_week_start_date() -> date:
    """Helper function to get the date of the Monday of the current week."""
    today = date.today()
    # weekday() returns 0 for Monday, 1 for Tuesday, ..., 6 for Sunday
    start_of_week = today - timedelta(days=today.weekday())
    return start_of_week

@router.post(
    "/",
    response_model=WeeklyGoal,
    status_code=status.HTTP_200_OK, # 200 OK because upsert can create or update
    summary="Create or Update Weekly Goal",
    description="Creates a new weekly goal for the user for the specified week_start_date, or updates it if it already exists."
)
async def upsert_weekly_goal(
    goal_data: WeeklyGoalCreate,
    current_user: CurrentUser,
    authed_supabase: AuthedSupabaseClient
):
    """
    Upserts (creates or updates) a weekly goal for the authenticated user.
    Requires week_start_date in the payload.
    """
    user_id = current_user.id

    # Basic validation - ensure week_start_date is a Monday? Optional, but good practice.
    if goal_data.week_start_date.weekday() != 0:
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="week_start_date must be a Monday."
         )

    # Prepare data for upsert
    data_to_upsert = goal_data.model_dump(exclude_unset=True) # Exclude unset to allow partial target setting if needed
    data_to_upsert['user_id'] = str(user_id)
    data_to_upsert['week_start_date'] = goal_data.week_start_date.isoformat()

    try:
        response = authed_supabase.table("user_weekly_goals") \
            .upsert(data_to_upsert, on_conflict='user_id, week_start_date') \
            .execute()

        if response is None or not hasattr(response, 'data') or not response.data:
            print(f"Failed response upserting weekly goal for user {user_id}, week {goal_data.week_start_date}: {response}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save weekly goal in database"
            )

        saved_data = response.data[0]
        return WeeklyGoal(**saved_data) # Return the full model

    except HTTPException as e:
        raise e # Re-raise known HTTP exceptions
    except Exception as e:
        print(f"Error upserting weekly goal for user {user_id}, week {goal_data.week_start_date}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An API error occurred: {e}"
        )


@router.get(
    "/",
    response_model=Optional[WeeklyGoal],
    summary="Get Weekly Goal",
    description="Retrieves the weekly goal for the authenticated user for a specific week (defaults to the current week)."
)
async def get_weekly_goal(
    current_user: CurrentUser,
    authed_supabase: AuthedSupabaseClient,
    week_start_date_str: Optional[str] = Query(None, description="The start date (Monday) of the week to retrieve (YYYY-MM-DD). Defaults to the current week.", alias="week_start_date")
):
    """
    Retrieves the weekly goal for the user.
    If week_start_date is not provided, defaults to the Monday of the current week.
    """
    user_id = current_user.id
    target_week_start_date: date

    if week_start_date_str:
        try:
            target_week_start_date = date.fromisoformat(week_start_date_str)
            if target_week_start_date.weekday() != 0:
                raise ValueError("Provided date is not a Monday.")
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid week_start_date format or value: {e}. Use YYYY-MM-DD for a Monday."
            )
    else:
        target_week_start_date = get_current_week_start_date()

    target_week_start_date_iso = target_week_start_date.isoformat()

    try:
        # --- Add Logging ---
        print(f"DEBUG [get_weekly_goal]: Attempting query for user_id: {user_id}, week_start_date: {target_week_start_date_iso}")
        print(f"DEBUG [get_weekly_goal]: Client type: {type(authed_supabase)}")
        # You might add more checks here if possible, e.g., inspecting client headers if the library allows

        response = authed_supabase.table("user_weekly_goals") \
            .select("*") \
            .eq("user_id", str(user_id)) \
            .eq("week_start_date", target_week_start_date_iso) \
            .execute()

        # --- Add Logging ---
        print(f"DEBUG [get_weekly_goal]: Query executed. Response object: {response}") # See what response looks like

        if response is None:
             print(f"ERROR [get_weekly_goal]: Execute returned None for user {user_id}, week {target_week_start_date_iso}")
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database get operation failed unexpectedly (execute returned None).")

        # --- Handle list response --- #
        if not response.data: # Empty list means no goal found
            print(f"DEBUG [get_weekly_goal]: No goal found for user {user_id}, week {target_week_start_date_iso}")
            return None
        elif len(response.data) > 1:
            # This shouldn't happen due to UNIQUE constraint, but log if it does
            print(f"WARNING [get_weekly_goal]: Multiple goals found for user {user_id}, week {target_week_start_date_iso}. Returning the first one.")
            # Fall through to return the first item
        
        # Parse and return the first (and likely only) goal
        found_goal_data = response.data[0]
        return WeeklyGoal(**found_goal_data)

    except HTTPException as e:
        raise e # Re-raise known HTTP exceptions
    except Exception as e:
        print(f"Error retrieving weekly goal for user {user_id}, week {target_week_start_date_iso}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An API error occurred: {e}"
        )

# TODO: Potentially add PUT for partial updates using WeeklyGoalUpdate if needed,
# although upsert handles most cases. A DELETE endpoint might also be useful.
# TODO: Add endpoint to get historical goals? GET /users/me/weekly-goals/ (plural) 