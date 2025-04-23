from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
# from supabase.lib.auth.model import User # Remove incorrect import
from gotrue.types import User as SupabaseUser # Import correct User type
from typing import List, Optional
import uuid

from ..services.supabase_client import get_supabase_client
from ..models.user_pr import UserPr # Import the UserPr model
from .auth import get_current_user # Import the auth dependency

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

# TODO: Add endpoints for creating, updating, deleting PRs (POST, PUT/PATCH, DELETE)
# These would also use the get_current_user dependency. 