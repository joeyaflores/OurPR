from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from gotrue.types import User as SupabaseUser
from postgrest import APIError as PostgrestAPIError
import uuid
from typing import List # Import List for response model

from ..services.supabase_client import get_supabase_client
from ..models.user_race_plan import UserRacePlan, UserRacePlanCreate # Import models
from ..models.race import Race # <-- Import the Race model
from .auth import get_current_user # Import auth dependency

router = APIRouter(
    prefix="/users/me/plan", # Prefix for all routes in this file
    tags=["User Plan"] # Tag for API docs
)

@router.get(
    "/",
    response_model=List[Race], # <-- Change response model to List[Race]
    summary="Get full race details for races in the authenticated user's plan"
)
async def get_user_plan(
    *, # Keyword-only args below
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Retrieves full race details for races currently in the authenticated user's plan."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = current_user.id

    try:
        # Select all fields from the related 'races' table
        # Assumes 'race_id' in 'user_race_plans' is a foreign key to 'races.id'
        response = supabase.table("user_race_plans")\
                           .select("races(*)")\
                           .eq("user_id", str(user_id))\
                           .execute()

        if not hasattr(response, 'data') or not isinstance(response.data, list):
            print(f"Unexpected response getting plan for user {user_id}: {response}")
            raise HTTPException(status_code=500, detail="Unexpected response format from database")

        # Extract the 'races' dictionary from each item in the list
        # Handle cases where 'races' might be null if the FK relationship or data is broken
        planned_races = [item['races'] for item in response.data if item.get('races')]
        
        # Pydantic will validate that the dictionaries match the Race model structure
        return planned_races

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