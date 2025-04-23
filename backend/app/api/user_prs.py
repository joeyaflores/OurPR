from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from supabase import Client
# from supabase.lib.auth.model import User # Remove incorrect import
from gotrue.types import User as SupabaseUser # Import correct User type
from typing import List, Optional
import uuid
from datetime import date as date_obj # Import date object with alias

from ..services.supabase_client import get_supabase_client
from ..models.user_pr import UserPr # Import the UserPr model
from .auth import get_current_user # Import the auth dependency
# Add UserPrCreate and UserPrUpdate imports
from ..models.user_pr import UserPrCreate, UserPrUpdate

router = APIRouter()

@router.get("/users/me/prs", response_model=List[UserPr], tags=["User PRs"])
async def get_my_prs(
    *, # Keyword-only arguments
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user), # Use correct type hint
    distance: Optional[str] = Query(None, description="Filter PRs by distance (e.g., '5K', 'Marathon')"),
    skip: int = 0,
    limit: int = 100
):
    """Retrieve the authenticated user's personal records (PRs)."""
    if not current_user or not current_user.id:
        # This should theoretically be caught by get_current_user, but double-check
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = current_user.id

    try:
        query = supabase.table("user_prs").select("*").eq("user_id", str(user_id))

        # Apply optional filters
        if distance:
            query = query.eq("distance", distance)

        # Apply sorting (e.g., by date descending to show most recent first)
        query = query.order("date", desc=True)

        # Apply pagination
        query = query.offset(skip).limit(limit)

        response = query.execute()

        if not hasattr(response, 'data') or not isinstance(response.data, list):
            print(f"Unexpected response from Supabase getting PRs for user {user_id}: {response}")
            raise HTTPException(status_code=500, detail="Unexpected response format from database")

        return response.data

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error querying PRs for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching user PRs: {e}")

# --- Add CREATE Endpoint ---
@router.post("/users/me/prs", response_model=UserPr, status_code=status.HTTP_201_CREATED, tags=["User PRs"])
async def create_my_pr(
    *,
    pr_in: UserPrCreate,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Create a new personal record for the authenticated user."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = current_user.id

    # Ensure the user_id in the payload matches the authenticated user
    # Compare string representations to avoid type mismatch
    if str(pr_in.user_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Cannot create PR for another user")

    try:
        # Convert Pydantic model to dict for insertion
        pr_data = pr_in.model_dump(exclude_unset=True) # Pydantic v2
        pr_data['user_id'] = str(user_id) # Ensure user_id is string for Supabase
        pr_data['date'] = pr_data['date'].isoformat() # Convert date to ISO string

        response = supabase.table("user_prs").insert(pr_data).execute()

        if not hasattr(response, 'data') or not response.data or not isinstance(response.data, list):
            print(f"Failed response inserting PR for user {user_id}: {response}")
            raise HTTPException(status_code=500, detail="Failed to create PR in database")

        # Assuming Supabase returns the created row(s) in response.data
        created_pr_data = response.data[0]
        return created_pr_data # Pydantic will parse this dict into UserPr

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error creating PR for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred while creating the PR: {e}")

# --- Add UPDATE Endpoint ---
@router.put("/users/me/prs/{pr_id}", response_model=UserPr, tags=["User PRs"])
async def update_my_pr(
    *,
    pr_id: uuid.UUID,
    pr_update: UserPrUpdate,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Update an existing personal record for the authenticated user."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = current_user.id

    try:
        # Convert Pydantic model to dict, excluding unset values
        update_data = pr_update.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided")

        # Explicitly handle date string conversion
        if 'date' in update_data and update_data['date']:
            try:
                # Parse the string (expecting YYYY-MM-DD)
                parsed_date = date_obj.fromisoformat(update_data['date'])
                # Convert back to ISO string for Supabase update
                update_data['date'] = parsed_date.isoformat()
            except ValueError:
                # Handle invalid date format string from client
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

        # Update the record, ensuring it belongs to the current user
        response = supabase.table("user_prs") \
            .update(update_data) \
            .eq("id", str(pr_id)) \
            .eq("user_id", str(user_id)) \
            .execute()

        if not hasattr(response, 'data') or not response.data or not isinstance(response.data, list):
            # Check if it was simply not found vs. another error
            check_resp = supabase.table("user_prs").select("id").eq("id", str(pr_id)).eq("user_id", str(user_id)).execute()
            if not hasattr(check_resp, 'data') or not check_resp.data:
                raise HTTPException(status_code=404, detail=f"PR with id {pr_id} not found for this user")
            else:
                print(f"Failed response updating PR {pr_id} for user {user_id}: {response}")
                raise HTTPException(status_code=500, detail="Failed to update PR in database")

        # Assuming Supabase returns the updated row(s) in response.data
        updated_pr_data = response.data[0]
        return updated_pr_data # Pydantic will parse

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error updating PR {pr_id} for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred while updating the PR: {e}")

# --- Add DELETE Endpoint ---
@router.delete("/users/me/prs/{pr_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["User PRs"])
async def delete_my_pr(
    *,
    pr_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Delete a personal record for the authenticated user."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = current_user.id

    try:
        # Delete the record, ensuring it belongs to the current user
        response = supabase.table("user_prs") \
            .delete() \
            .eq("id", str(pr_id)) \
            .eq("user_id", str(user_id)) \
            .execute()

        # Check if any rows were actually deleted (response.data might be empty on success)
        # A more robust check might involve checking response status or count if available
        # For now, we check if it *still* exists after the delete attempt
        check_resp = supabase.table("user_prs").select("id").eq("id", str(pr_id)).eq("user_id", str(user_id)).execute()
        if hasattr(check_resp, 'data') and check_resp.data:
            print(f"Failed response deleting PR {pr_id} for user {user_id}: {response}")
            # If it still exists, the delete failed for some reason other than not found
            raise HTTPException(status_code=500, detail="Failed to delete PR")
        elif not hasattr(response, 'data'):
            # If response structure is unexpected, log and raise 500
            print(f"Unexpected response structure deleting PR {pr_id} for user {user_id}: {response}")
            raise HTTPException(status_code=500, detail="Unexpected response during delete")
        # If check_resp found nothing, the delete was successful (or it never existed)
        # In either case, 204 is appropriate. If it didn't exist, delete is idempotent.

        return Response(status_code=status.HTTP_204_NO_CONTENT)

    except HTTPException as e:
        raise e # Re-raise known HTTP exceptions
    except Exception as e:
        print(f"Error deleting PR {pr_id} for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred while deleting the PR: {e}")

# TODO: Add endpoints for creating, updating, deleting PRs (POST, PUT/PATCH, DELETE)
# These would also use the get_current_user dependency. 