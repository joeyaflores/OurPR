from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from supabase import Client
from gotrue.types import User as SupabaseUser
from typing import List, Optional
import uuid
from datetime import date as date_obj

from ..services.supabase_client import get_supabase_client
from .auth import get_current_user
from ..models.workout import Workout, WorkoutCreate, WorkoutUpdate

router = APIRouter()

# Endpoint to create a new workout
@router.post("/users/me/workouts", response_model=Workout, status_code=status.HTTP_201_CREATED, tags=["Workouts"])
async def create_my_workout(
    *,
    workout_in: WorkoutCreate, # Use WorkoutCreate which excludes user_id initially
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Log a new workout for the authenticated user."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = current_user.id
    
    # Convert Pydantic model to dict for insertion, excluding unset defaults
    workout_data = workout_in.model_dump(exclude_unset=True)
    
    # Add user_id and ensure date is string
    workout_data['user_id'] = str(user_id)
    workout_data['date'] = workout_in.date.isoformat()

    try:
        response = supabase.table("user_workouts").insert(workout_data).execute()

        if not hasattr(response, 'data') or not response.data or not isinstance(response.data, list):
            print(f"Failed response inserting workout for user {user_id}: {response}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create workout in database")

        created_workout_data = response.data[0]
        return created_workout_data

    except Exception as e:
        print(f"Error creating workout for user {user_id}: {e}")
        # Consider more specific error handling (e.g., for DB constraints)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred: {e}")

# Endpoint to retrieve user's workouts with filtering and pagination
@router.get("/users/me/workouts", response_model=List[Workout], tags=["Workouts"])
async def get_my_workouts(
    *,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user),
    start_date: Optional[date_obj] = Query(None, description="Filter workouts on or after this date"),
    end_date: Optional[date_obj] = Query(None, description="Filter workouts on or before this date"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type (e.g., 'run')"),
    skip: int = 0,
    limit: int = 50 # Default limit
):
    """Retrieve the authenticated user's logged workouts."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = current_user.id

    try:
        query = supabase.table("user_workouts").select("*").eq("user_id", str(user_id))

        # Apply optional filters
        if start_date:
            query = query.gte("date", str(start_date))
        if end_date:
            query = query.lte("date", str(end_date))
        if activity_type:
            query = query.eq("activity_type", activity_type)

        # Apply sorting (e.g., by date descending)
        query = query.order("date", desc=True).order("created_at", desc=True)

        # Apply pagination
        query = query.offset(skip).limit(limit)

        response = query.execute()

        if not hasattr(response, 'data') or not isinstance(response.data, list):
            print(f"Unexpected response getting workouts for user {user_id}: {response}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected response format from database")

        return response.data

    except Exception as e:
        print(f"Error querying workouts for user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred: {e}")

# Endpoint to update an existing workout
@router.put("/users/me/workouts/{workout_id}", response_model=Workout, tags=["Workouts"])
async def update_my_workout(
    *,
    workout_id: uuid.UUID,
    workout_update: WorkoutUpdate,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Update an existing workout for the authenticated user."""
    if not current_user or not current_user.id:
         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = current_user.id
    
    # Convert Pydantic model to dict, excluding unset values
    update_data = workout_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")

    # Handle date conversion if present
    if 'date' in update_data and isinstance(update_data['date'], date_obj):
        update_data['date'] = update_data['date'].isoformat()
    elif 'date' in update_data: # Allow string date input
        try:
             parsed_date = date_obj.fromisoformat(str(update_data['date']))
             update_data['date'] = parsed_date.isoformat()
        except (ValueError, TypeError):
             raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    try:
        response = supabase.table("user_workouts") \
            .update(update_data) \
            .eq("id", str(workout_id)) \
            .eq("user_id", str(user_id)) \
            .execute()

        if not hasattr(response, 'data') or not response.data or not isinstance(response.data, list):
            # Check if not found vs. other error
            check_resp = supabase.table("user_workouts").select("id").eq("id", str(workout_id)).eq("user_id", str(user_id)).execute()
            if not hasattr(check_resp, 'data') or not check_resp.data:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workout with id {workout_id} not found")
            else:
                print(f"Failed response updating workout {workout_id} for user {user_id}: {response}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update workout")

        updated_workout_data = response.data[0]
        return updated_workout_data

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error updating workout {workout_id} for user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred: {e}")


# Endpoint to delete a workout
@router.delete("/users/me/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Workouts"])
async def delete_my_workout(
    *,
    workout_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Delete a workout for the authenticated user."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = current_user.id

    try:
        response = supabase.table("user_workouts") \
            .delete() \
            .eq("id", str(workout_id)) \
            .eq("user_id", str(user_id)) \
            .execute()

        # Basic check: if the response data is empty after delete, it likely succeeded or didn't exist
        # Supabase delete often returns empty data on success. Need to check if it *still* exists.
        check_resp = supabase.table("user_workouts").select("id").eq("id", str(workout_id)).eq("user_id", str(user_id)).execute()
        if hasattr(check_resp, 'data') and check_resp.data:
             print(f"Failed response deleting workout {workout_id} for user {user_id}: {response}")
             raise HTTPException(status_code=500, detail="Failed to delete workout")
        # If check_resp has no data, it means the workout is gone (either deleted now or never existed)
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    except Exception as e:
        print(f"Error deleting workout {workout_id} for user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred: {e}") 