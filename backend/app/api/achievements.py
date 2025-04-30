from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from gotrue.types import User as SupabaseUser
from typing import List

from ..services.supabase_client import get_supabase_client
from .auth import get_current_user
from ..models.achievement import EarnedAchievementDetail # Import the response model

router = APIRouter()

@router.get("/users/me/achievements", response_model=List[EarnedAchievementDetail], tags=["Achievements"])
async def get_my_earned_achievements(
    *,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user),
    limit: int = 100 # Optional limit
):
    """Retrieve the authenticated user's earned achievements."""
    if not current_user or not current_user.id:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = current_user.id

    try:
        # Fetch user achievements joined with achievement details
        # Adjust the select query based on the final EarnedAchievementDetail model
        query = supabase.table("user_achievements") \
            .select("""
                earned_at,
                achievement_id:achievement_id, 
                achievements ( code, name, description, icon_name )
            """) \
            .eq("user_id", str(user_id)) \
            .order("earned_at", desc=True) \
            .limit(limit)

        response = query.execute()

        if not hasattr(response, 'data') or not isinstance(response.data, list):
            print(f"Unexpected response getting achievements for user {user_id}: {response}")
            raise HTTPException(status_code=500, detail="Unexpected response format from database")

        # Transform data to match EarnedAchievementDetail model
        # The join returns nested 'achievements' object
        transformed_data = []
        for item in response.data:
            if item.get('achievements'): # Check if join data exists
                transformed_data.append({
                    'earned_at': item['earned_at'],
                    'achievement_id': item['achievement_id'],
                    'code': item['achievements']['code'],
                    'name': item['achievements']['name'],
                    'description': item['achievements']['description'],
                    'icon_name': item['achievements']['icon_name'],
                })
            else:
                 print(f"Warning: User achievement record {item.get('id')} missing joined achievement data.")

        return transformed_data

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error querying achievements for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching achievements: {e}") 