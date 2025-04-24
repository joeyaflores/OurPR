from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Annotated, List, Optional
from datetime import date, timedelta
from postgrest import SyncPostgrestClient
from supabase import Client

# Remove direct import
# from app.services.supabase_client import supabase
# <<< Import dependency injectors >>>
from app.services.supabase_client import get_supabase_client, get_base_supabase_client

# Import models
from app.models.race import Race # Assuming Race model includes new fields
from app.models.user_goal import UserGoal # Import UserGoal

# Import auth dependency and user model
from app.api.auth import get_current_user
from gotrue.types import User as SupabaseUser # <<< Use SupabaseUser type

# Placeholder for location data - Replace with actual user profile/location service later
# For now, we might try to get it from the user's goal or a hypothetical profile endpoint
def get_user_location(user_id: str) -> Optional[dict]:
    # TODO: Implement actual location fetching (e.g., from user profile table or GeoIP)
    # Example: Fetch from a hypothetical user_profile table
    # response = supabase.table('user_profiles').select('city, state').eq('user_id', user_id).maybe_single().execute()
    # if response.data:
    #     return response.data
    return None # Placeholder

router = APIRouter(
    prefix="/users/me/recommended-races",
    tags=["Recommendations"],
)

# Use SupabaseUser type
CurrentUser = Annotated[SupabaseUser, Depends(get_current_user)]
# Define type hints for injected clients
AuthedSupabaseClient = Annotated[SyncPostgrestClient, Depends(get_supabase_client)]
BaseSupabaseClient = Annotated[Client, Depends(get_base_supabase_client)]

@router.get(
    "/",
    response_model=List[Race],
    summary="Get Personalized Race Recommendations",
    description="Provides race recommendations based on the user's goal and location."
)
def get_recommended_races(
    current_user: CurrentUser, 
    request: Request, # Keep request if needed for GeoIP later
    # <<< Inject both clients >>>
    authed_supabase: AuthedSupabaseClient, 
    base_supabase: BaseSupabaseClient 
):
    user_id = current_user.id

    # 1. Get User's Goal (using authenticated client)
    try:
        # Use authed_supabase
        goal_response = authed_supabase.table('user_goals')\
            .select("*")\
            .eq('user_id', str(user_id))\
            .maybe_single()\
            .execute()
        
        # Add error check based on response object structure
        # if hasattr(goal_response, 'error') and goal_response.error:
        #    print(f"Supabase DB Error (Fetching Goal): {goal_response.error}")
        #    raise HTTPException(status_code=goal_response.status_code or 500, detail=goal_response.error.message)
            
        user_goal_data = goal_response.data
        user_goal = UserGoal(**user_goal_data) if user_goal_data else None
    except Exception as e:
        # Catch potential exceptions from execute() or Pydantic parsing
        print(f"Error fetching or parsing user goal: {e}")
        # Check if it's a PostgrestError for more specific handling?
        # from postgrest.exceptions import APIError
        # if isinstance(e, APIError): ...
        raise HTTPException(status_code=500, detail="Could not retrieve user goal information.")

    # 2. Determine Location (Placeholder)
    user_location = get_user_location(user_id)
    # TODO: Add more robust location detection (GeoIP from request.client.host?)

    # 3. Query Races - Build query dynamically (using base client)
    # Use base_supabase
    query = base_supabase.table('races').select("*")

    # Filter by distance (if specified in goal)
    if user_goal and user_goal.goal_distance:
        query = query.eq('distance', user_goal.goal_distance)

    # Filter by date range (e.g., next 6-9 months, or before goal race date)
    today = date.today()
    if user_goal and user_goal.goal_race_date:
        # Look for races between now and their goal date
        query = query.gte('date', today.isoformat())
        query = query.lte('date', user_goal.goal_race_date.isoformat())
    else:
        # Default: Look for races in the next 9 months
        end_date = today + timedelta(days=270)
        query = query.gte('date', today.isoformat())
        query = query.lte('date', end_date.isoformat())

    # Filter by location (if available)
    if user_location:
        if user_location.get('city'):
            query = query.eq('city', user_location['city'])
        if user_location.get('state'):
            query = query.eq('state', user_location['state'])
    # TODO: Add radius-based filtering if lat/lon and PostGIS are available

    # Execute the initial query based on user goal
    try:
        print(f"Executing initial race query for user {user_id}...")
        race_response = query.execute()
        races = race_response.data
        print(f"Initial query found {len(races) if races else 0} races.")

        # <<< Fallback Logic >>>
        if not races:
            print(f"Initial query empty. Executing fallback query for user {user_id}...")
            fallback_query = base_supabase.table('races')\
                .select("*")\
                .gte('date', today.isoformat()) \
                .order('date', desc=False) \
                .limit(20)
            
            fallback_response = fallback_query.execute()
            if fallback_response and fallback_response.data:
                races = fallback_response.data # Overwrite races with fallback results
                print(f"Fallback query found {len(races)} races.")
            else:
                # Handle case where fallback also fails or returns empty
                print(f"Fallback query also returned no data or failed. Response: {fallback_response}")
                races = [] # Ensure races is an empty list
        # <<< End Fallback Logic >>>
            
    except Exception as e:
        print(f"Error fetching races (initial or fallback): {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve race data.")

    # If still no races after fallback, return empty list
    if not races:
        print(f"No races found for user {user_id} after fallback.")
        return []

    # 4. Rank Races (Simple Ranking)
    print(f"Ranking {len(races)} races...")
    def sort_key(race):
        flatness = race.get('flatness_score', 0) or 0
        # Use pr_potential_score from the model if available, otherwise historical_pr_rate
        pr_potential = race.get('pr_potential_score', 0) or 0
        # historical_pr_rate = race.get('historical_pr_rate', 0) or 0 # Keep if needed
        return (-flatness, -pr_potential) # Prioritize flat, then high PR potential

    ranked_races = sorted(races, key=sort_key)

    # 5. Return Top N Recommendations (e.g., top 5)
    top_n = 5
    recommended_races_data = ranked_races[:top_n]
    print(f"Returning top {len(recommended_races_data)} recommendations.")

    # Parse data with Pydantic model
    try:
        result = [Race(**race_data) for race_data in recommended_races_data]
        return result
    except Exception as e:
         # Log error details
        print(f"Error parsing race data for recommendations: {e}")
        # Return raw data or a subset if parsing fails?
        # For now, raise an error or return empty list
        raise HTTPException(status_code=500, detail="Error processing race data.") 