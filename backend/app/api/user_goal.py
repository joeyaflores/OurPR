from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import Annotated, Optional
from datetime import timedelta # Import timedelta
from supabase import Client # <<< Add Client import
from postgrest import SyncPostgrestClient # <<< Import Postgrest client type

# Remove direct supabase import, use dependency injection instead
# from app.services.supabase_client import supabase 
from app.services.supabase_client import get_supabase_client # <<< Import client factory

from app.models.user_goal import UserGoal, UserGoalCreate # Removed UserGoalUpdate as upsert handles it
from app.api.auth import get_current_user # Your auth dependency
from gotrue.types import User as SupabaseUser # <<< Import correct User type from gotrue

# Placeholder for user model from auth if needed - Replaced by SupabaseUser
# class User:
#     id: str

router = APIRouter(
    prefix="/users/me/goal",
    tags=["User Goal"],
    # dependencies=[Depends(get_current_user)] # Apply auth to all routes in this router
)

# Use SupabaseUser for type hinting
CurrentUser = Annotated[SupabaseUser, Depends(get_current_user)] 
# Define type hint for the injected authenticated Postgrest client
AuthedSupabaseClient = Annotated[SyncPostgrestClient, Depends(get_supabase_client)]

# Remove the unused helper function
# def get_request_authenticated_supabase_client(token: str):
#     ... (removed) ...

@router.post(
    "/",
    response_model=UserGoal,
    status_code=status.HTTP_200_OK, # Change to 200 OK as it can be update or create
    summary="Create or Update User Goal",
    description="Creates a new goal for the authenticated user or updates the existing one."
)
def create_or_update_user_goal(
    goal_data: UserGoalCreate, 
    current_user: CurrentUser,
    # Remove authorization header dependency here
    # supabase: Client = Depends(get_supabase_client) # Old injection
    authed_supabase: AuthedSupabaseClient # <<< Inject configured Postgrest client
):
    user_id = current_user.id
    
    # <<< Remove Basic Connectivity Check >>>
    # try:
    #     print("DEBUG: Performing basic connectivity check...")
    #     ping_response = supabase.table("non_existent_test_table_should_fail").select("id").limit(1).execute()
    #     print(f"DEBUG: Basic connectivity check response: {ping_response}")
    #     if ping_response is None:
    #          print("ERROR: Basic connectivity check returned None! Possible network/config issue.")
    #          raise HTTPException(status_code=503, detail="Backend cannot connect to database service.")
    # except Exception as ping_exc:
    #     print(f"ERROR: Basic connectivity check failed with exception: {ping_exc}")
    #     raise HTTPException(status_code=503, detail=f"Backend connectivity error: {ping_exc}")
    # <<< End Basic Connectivity Check >>>

    # Prepare data to save
    data_to_save = goal_data.model_dump(exclude_unset=True)
    if 'goal_time' in data_to_save and data_to_save['goal_time'] is not None:
        data_to_save['goal_time'] = str(data_to_save['goal_time'])
    if 'goal_race_date' in data_to_save and data_to_save['goal_race_date'] is not None:
        data_to_save['goal_race_date'] = data_to_save['goal_race_date'].isoformat()
    data_to_save['user_id'] = str(user_id)
    
    try:
        # Remove client setup
        # authed_client = supabase.postgrest.auth(token)
        # Remove debug logging for client/token

        # Remove query prep logging

        # 1. Check if a goal already exists (Use injected authed_supabase)
        # Remove .maybe_single() and check data length instead
        existing_goal_response = authed_supabase.table('user_goals')\
            .select('id')\
            .eq('user_id', str(user_id))\
            .limit(1)\
            .execute()
        
        # Keep None check for potential library issues
        if existing_goal_response is None:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database check operation failed unexpectedly (execute returned None).")

        # Add error check based on response object structure
        # if hasattr(existing_goal_response, 'error') and existing_goal_response.error:
        #    print(f"Supabase DB Error (Check): {existing_goal_response.error}")
        #    raise HTTPException(status_code=existing_goal_response.status_code or 500, detail=existing_goal_response.error.message)
            
        # Check if data list is non-empty to determine existence
        existing_goal = existing_goal_response.data and len(existing_goal_response.data) > 0

        if existing_goal:
            # 2a. Update existing goal (Use injected authed_supabase)
            update_response = authed_supabase.table('user_goals')\
                .update(data_to_save)\
                .eq('user_id', str(user_id))\
                .execute()
            
            if update_response is None: 
                 raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database update operation failed unexpectedly (execute returned None).")
            # Add error check on response object
            # if hasattr(update_response, 'error') and update_response.error:
            #    print(f"Supabase DB Error (Update): {update_response.error}")
            #    raise HTTPException(status_code=update_response.status_code or 500, detail=update_response.error.message)
            
            if not update_response.data or len(update_response.data) == 0:
                 # Check if the record actually exists before claiming update failed
                 check_resp = authed_supabase.table("user_goals").select("id").eq("user_id", str(user_id)).limit(1).execute() # Use limit(1)
                 if not check_resp or not check_resp.data:
                     raise HTTPException(status_code=status.HTTP_404, detail="User goal not found, cannot update.")
                 else:
                     print(f"Update response indicated failure, but data exists. Response Data: {update_response.data}") 
                     raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user goal")
            saved_data = update_response.data[0]
        else:
            # 2b. Insert new goal (Use injected authed_supabase)
            insert_response = authed_supabase.table('user_goals')\
                .insert(data_to_save)\
                .execute()
            
            if insert_response is None: 
                 raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database insert operation failed unexpectedly (execute returned None).")
            # Add error check on response object
            # if hasattr(insert_response, 'error') and insert_response.error:
            #    print(f"Supabase DB Error (Insert): {insert_response.error}")
            #    raise HTTPException(status_code=insert_response.status_code or 500, detail=insert_response.error.message)

            if not insert_response.data or len(insert_response.data) == 0:
                 raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user goal or no data returned")
            saved_data = insert_response.data[0]

        # Parse and return the saved data
        if saved_data.get('goal_time') and isinstance(saved_data['goal_time'], str):
             try:
                 h, m, s = map(int, saved_data['goal_time'].split(':'))
                 saved_data['goal_time'] = timedelta(hours=h, minutes=m, seconds=s)
             except ValueError:
                 print(f"Warning: Could not parse goal_time '{saved_data['goal_time']}' for user {user_id}")
                 saved_data['goal_time'] = None 
        
        return UserGoal(**saved_data)

    # Keep generic exception handler, but specific execute errors should be caught by library now
    except HTTPException as e: 
        raise e
    except Exception as e:
        print(f"Error saving user goal for user {user_id}: {e}") 
        # Consider checking e type for specific Supabase/Postgrest errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An API error occurred: {e}")

@router.get(
    "/",
    response_model=Optional[UserGoal], # Allow returning null/None if not found
    summary="Get User Goal",
    description="Retrieves the goal for the authenticated user, if it exists."
)
def get_user_goal(
    current_user: CurrentUser,
    # Remove authorization header dependency here
    # supabase: Client = Depends(get_supabase_client) # Old injection
    authed_supabase: AuthedSupabaseClient # <<< Inject configured Postgrest client
):
    user_id = current_user.id
    # Remove token extraction

    try:
        # Remove client setup and debug logs
        # Remove specific try/except around execute
        response = authed_supabase.table('user_goals')\
            .select("*")\
            .eq('user_id', str(user_id))\
            .maybe_single()\
            .execute()
            
        # Remove raw response debug log
        # print(f"DEBUG: Raw get_user_goal ...")

        if response is None: 
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database get operation failed unexpectedly (execute returned None).")
        # Add error check on response object
        # if hasattr(response, 'error') and response.error:
        #    print(f"Supabase DB Error (Get): {response.error}")
        #    raise HTTPException(status_code=response.status_code or 500, detail=response.error.message)

        if not response.data:
            return None 

        fetched_data = response.data 
        if fetched_data.get('goal_time') and isinstance(fetched_data['goal_time'], str):
            try:
                h, m, s = map(int, fetched_data['goal_time'].split(':'))
                fetched_data['goal_time'] = timedelta(hours=h, minutes=m, seconds=s)
            except ValueError:
                 print(f"Warning: Could not parse goal_time '{fetched_data['goal_time']}' for user {user_id}")
                 fetched_data['goal_time'] = None

        return UserGoal(**fetched_data)

    # Keep generic exception handler
    except HTTPException as e: 
        raise e
    except Exception as e:
        print(f"Error retrieving user goal for user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred: {e}")