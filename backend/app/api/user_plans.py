from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from gotrue.types import User as SupabaseUser
from postgrest import APIError as PostgrestAPIError
import uuid
from typing import List # Import List for response model
from datetime import date
from pydantic import ValidationError

from ..services.supabase_client import get_supabase_client
from ..models.user_race_plan import UserRacePlan, UserRacePlanCreate, PlannedRaceDetail # <-- Import new model
from ..models.race import Race # <-- Import the Race model
from ..models.user_pr import UserPr # Import PR model
from .auth import get_current_user # Import auth dependency

router = APIRouter(
    prefix="/users/me/plan", # Prefix for all routes in this file
    tags=["User Plan"] # Tag for API docs
)

@router.get(
    "/",
    response_model=List[PlannedRaceDetail], # <-- Use the new response model
    summary="Get full race details and plan status for races in the authenticated user's plan"
)
async def get_user_plan(
    *, # Keyword-only args below
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Retrieves full race details, plus generated plan status, for races in the user's plan."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = current_user.id

    try:
        # 1. Get the user's planned races with race details
        plan_response = supabase.table("user_race_plans")\
                           .select("id, race_id, races(*)")\
                           .eq("user_id", str(user_id))\
                           .execute()

        if not hasattr(plan_response, 'data') or not isinstance(plan_response.data, list):
            print(f"Unexpected response getting plan for user {user_id}: {plan_response}")
            raise HTTPException(status_code=500, detail="Unexpected response format fetching plans")

        user_planned_races = plan_response.data
        # print(f"[get_user_plan] User {user_id} - Fetched planned races: {user_planned_races}") # <-- Log fetched plans
        if not user_planned_races:
            return [] # No races planned

        # 2. Get the IDs of races for which a plan HAS been generated for this user
        planned_race_ids = [item['race_id'] for item in user_planned_races if item.get('race_id')]
        saved_plan_race_ids = set()
        if planned_race_ids: # Only query if there are races to check
            saved_plan_response = supabase.table("user_generated_plans")\
                                        .select("race_id")\
                                        .eq("user_id", str(user_id))\
                                        .in_("race_id", planned_race_ids)\
                                        .execute()

            if hasattr(saved_plan_response, 'data') and isinstance(saved_plan_response.data, list):
                saved_plan_race_ids = {item['race_id'] for item in saved_plan_response.data}
            else:
                 print(f"Warning: Unexpected response fetching saved plan IDs for user {user_id}: {saved_plan_response}")

        # 3. Combine the data
        results: List[PlannedRaceDetail] = []
        for item in user_planned_races:
            if not item.get('races'): # Skip if race data is missing (shouldn't happen with inner join default)
                continue
                
            race_data = item['races']
            race_id = item.get('race_id')
            has_plan = race_id in saved_plan_race_ids
            
            combined_data = {
                **race_data,
                "user_race_plan_id": item['id'], # Use the actual user_race_plan ID
                "has_generated_plan": has_plan
            }
            
            try:
                planned_race = PlannedRaceDetail(**combined_data)
                results.append(planned_race)
            except ValidationError as e:
                print(f"Validation Error combining plan data: {e}, data: {combined_data}")
                continue
        
        # Sort results by date
        results.sort(key=lambda r: date.fromisoformat(r.date) if r.date else date.max)

        # print(f"[get_user_plan] User {user_id} - Final combined results: {results}") # <-- Log final results
        return results

    except PostgrestAPIError as e:
        # Handle potential PostgREST errors (e.g., permissions, invalid query)
        print(f"Database error fetching plan races for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error occurred: {e.message}"
        )
    except Exception as e:
        print(f"Error fetching plan races for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching the user plan races."
        )

@router.post(
    "/",
    response_model=UserRacePlan,
    status_code=status.HTTP_201_CREATED, # Set default success code to 201
    summary="Add a race to the authenticated user's plan"
)
async def add_race_to_plan(
    plan_data: UserRacePlanCreate, # Request body validated by this model
    *, # Keyword-only args below
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Adds a specified race to the currently authenticated user's plan."""
    if not current_user or not current_user.id:
        # Should be caught by dependency, but good practice to check
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = current_user.id
    race_id_to_add = plan_data.race_id

    try:
        # Prepare data for insertion
        insert_data = {
            "user_id": str(user_id),
            "race_id": str(race_id_to_add)
        }

        print(f"Attempting to add race {race_id_to_add} to plan for user {user_id}")

        # Execute the insert operation
        response = supabase.table("user_race_plans").insert(insert_data).execute()

        # Check if data was returned (successful insert)
        if not response.data or len(response.data) == 0:
            # This case might indicate an issue not caught by exceptions
            print(f"Insert into user_race_plans failed with no data returned. Response: {response}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to add race to plan")

        # Return the first element of the data list, which is the inserted record
        # Pydantic validation happens automatically via response_model
        return response.data[0]

    except PostgrestAPIError as e:
        # Specific handling for PostgREST errors (e.g., unique constraint violation)
        if e.code == '23505': # Unique violation code in PostgreSQL
            print(f"Race {race_id_to_add} already in plan for user {user_id}. Error: {e}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This race is already in your plan."
            )
        else:
            # Handle other database errors
            print(f"Database error adding race to plan for user {user_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error occurred: {e.message}"
            )
    except Exception as e:
        # Catch-all for unexpected errors
        print(f"Unexpected error adding race to plan for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while adding the race to your plan."
        )

@router.delete(
    "/{race_id}", # Use path parameter for the race ID
    status_code=status.HTTP_204_NO_CONTENT, # Standard success code for DELETE
    summary="Remove a race from the authenticated user's plan",
    responses={ # Define possible error responses for docs
        status.HTTP_401_UNAUTHORIZED: {"detail": "Authentication required"},
        status.HTTP_404_NOT_FOUND: {"detail": "Race not found in plan"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"detail": "Database error occurred"}
    }
)
async def remove_race_from_plan(
    race_id: uuid.UUID, # Get race_id from path
    *, # Keyword-only args below
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Removes a specified race from the currently authenticated user's plan."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = current_user.id
    race_id_to_remove = race_id

    try:
        print(f"Attempting to remove race {race_id_to_remove} from plan for user {user_id}")

        # Execute the delete operation
        response = supabase.table("user_race_plans")\
                           .delete()\
                           .match({"user_id": str(user_id), "race_id": str(race_id_to_remove)})\
                           .execute()

        # Check if any data was returned (Supabase delete returns deleted records)
        if not response.data or len(response.data) == 0:
            # If nothing was deleted, the item wasn't in the plan for this user
            print(f"Race {race_id_to_remove} not found in plan for user {user_id} during delete.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Race not found in plan")

        print(f"Successfully removed race {race_id_to_remove} from plan for user {user_id}")
        # No response body needed for 204 No Content
        return

    except HTTPException as e: # Re-raise HTTPExceptions (like 404)
        raise e
    except Exception as e:
        # Catch other potential database errors
        print(f"Error removing race {race_id_to_remove} from plan for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while removing the race from your plan."
        ) 