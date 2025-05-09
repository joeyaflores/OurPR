import os
import uuid
import secrets # <-- Import secrets for state generation
from datetime import date
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import RedirectResponse
from supabase.client import Client
from gotrue.types import User as SupabaseUser

from ..services.supabase_client import get_supabase_client, get_supabase_service_client, supabase_service_client
from ..api.auth import get_current_user
from ..models.training_plan import DetailedTrainingPlan # To parse stored plan
from ..services import google_calendar_service as gc_service

# Determine where to redirect the user after successful OAuth
# Ideally, this comes from env vars or config
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
# Simple in-memory store for state - replace with Redis/DB for production
# Store state against a session ID or similar temporary identifier if possible
_oauth_state_store = {}

router = APIRouter(
    tags=["Google Calendar"] 
)

# === OAuth Endpoints ===

@router.get("/auth/google/login", summary="Initiate Google OAuth Flow")
async def google_login(
    request: Request,
    current_user: SupabaseUser = Depends(get_current_user), # <-- Need user here
    supabase: Client = Depends(get_supabase_service_client) # <-- Use service client for DB access
):
    """Redirects the user to Google's OAuth 2.0 consent screen."""
    user_id = current_user.id
    flow = gc_service.get_google_auth_flow()
    if not flow:
        raise HTTPException(status_code=500, detail="Google OAuth flow could not be initialized.")

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    # --- Store state in DB --- 
    try:
        state_data = {"state": state, "user_id": str(user_id)}
        print(f"Attempting to insert state into DB: {state_data}") # Log data
        insert_resp = supabase.table("oauth_states")\
            .insert(state_data)\
            .execute()
        print(f"Supabase insert response: {insert_resp}") # Log response
        # Check for errors
        # Updated Check: Supabase v2 insert might return empty data list on success, check status_code
        # if not insert_resp.data: 
        if not hasattr(insert_resp, 'data') or (insert_resp.data is None and insert_resp.status_code // 100 != 2):
            print(f"Error storing OAuth state for user {user_id}: {insert_resp}")
            raise HTTPException(status_code=500, detail="Failed to initiate Google connection (state error).")
        print(f"Stored state in DB for user {user_id}: {state}") # Debug
    except Exception as e:
        print(f"Database error storing OAuth state for user {user_id}: {e}")
        # Also log traceback for unexpected errors
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to initiate Google connection (database error).")
    # -------------------------

    authorization_url, generated_state = flow.authorization_url(
        access_type='offline', # Request refresh token
        prompt='consent',     # Force consent screen even if previously approved
        state=state           # <-- Pass state to Google
    )

    print(f"Generated Google Auth URL for user {user_id}: {authorization_url}")
    # --- Return URL in JSON instead of redirecting --- 
    return {"authorization_url": authorization_url}
    # ---------------------------------------------------

@router.get("/auth/google/callback", summary="Handle Google OAuth Callback")
async def google_callback(
    request: Request, 
    code: str = Query(...),
    state: str = Query(...), # <-- Get state from Google redirect
    supabase: Client = Depends(get_supabase_service_client), # <-- Use service client
    # --- REMOVE current_user dependency --- 
    # current_user: SupabaseUser = Depends(get_current_user) 
):
    """Handles the callback from Google, exchanges code for tokens, and stores refresh token."""
    
    # --- State Validation --- 
    user_id_str: Optional[str] = None
    try:
        # Find the state, ensuring it hasn't expired
        select_resp = supabase.table("oauth_states")\
            .select("user_id")\
            .eq("state", state)\
            .gt("expires_at", "now()")\
            .maybe_single()\
            .execute()

        if select_resp.data:
            user_id_str = str(select_resp.data['user_id'])
            print(f"State validated successfully for user {user_id_str}") # Debug
            
            # --- Delete used state --- 
            try:
                delete_resp = supabase.table("oauth_states")\
                    .delete()\
                    .eq("state", state)\
                    .execute()
                # Log if delete fails, but don't necessarily block the flow
                if not delete_resp.data:
                    print(f"Warning: Failed to delete used OAuth state '{state}'. Response: {delete_resp}")
            except Exception as del_e:
                 print(f"Warning: Error deleting used OAuth state '{state}': {del_e}")
            # -------------------------
        else:
            # Check if state exists but is expired
            check_expired_resp = supabase.table("oauth_states").select("state").eq("state", state).maybe_single().execute()
            if check_expired_resp.data:
                 print(f"Expired OAuth state received: {state}")
                 # Clean up expired state while we're here (optional)
                 supabase.table("oauth_states").delete().eq("state", state).execute()
                 raise HTTPException(status_code=400, detail="OAuth session expired. Please try connecting again.")
            else:
                 print(f"Invalid OAuth state received: {state}")
                 raise HTTPException(status_code=400, detail="Invalid OAuth state parameter.")

    except Exception as e:
        print(f"Database error validating OAuth state '{state}': {e}")
        raise HTTPException(status_code=500, detail="Server error during authentication.")

    if not user_id_str:
        # Should have been caught above, but as a safeguard
        raise HTTPException(status_code=400, detail="Invalid OAuth state parameter (validation failed).")
    
    # ------------------------

    tokens = await gc_service.exchange_code_for_tokens(code)
    if not tokens:
        raise HTTPException(status_code=500, detail="Failed to exchange code for Google tokens.")

    _access_token, encrypted_refresh_token, _user_email = tokens

    if not encrypted_refresh_token:
        # This is problematic, user might need to re-authenticate to get a refresh token
        print(f"Warning: No refresh token received for user {user_id_str}. Calendar sync might require re-auth.")
        # Consider redirecting with an error or specific message?
        raise HTTPException(status_code=400, detail="Could not obtain necessary offline access (refresh token). Please try connecting again.")

    # --- Store Encrypted Refresh Token --- 
    # Now use user_id_str retrieved from state
    try:
        # Upsert logic: Insert if not exists, update if exists
        db_response = supabase.table("user_google_auth")\
            .upsert({
                "user_id": user_id_str, # Use ID from state
                "encrypted_google_refresh_token": encrypted_refresh_token,
                # "google_email": user_email # Optional
            }, on_conflict="user_id")\
            .execute()
        
        # Basic check for success (Supabase upsert returns data on success)
        if not db_response.data:
           print(f"Error storing refresh token for user {user_id_str}. Response: {db_response}")
           raise HTTPException(status_code=500, detail="Failed to save Google account connection.")
        print(f"Successfully stored/updated Google refresh token for user {user_id_str}")
    except Exception as e:
        print(f"Database error storing refresh token for user {user_id_str}: {e}")
        # Don't expose DB error details directly
        raise HTTPException(status_code=500, detail="Failed to save Google account connection due to a server error.")
    # --- End Token Storage --- 

    # --- DEBUGGING: Log the FRONTEND_URL being used ---
    runtime_frontend_url = os.getenv("FRONTEND_URL", "DEFAULT_VALUE_NOT_FOUND") # Read it within the function scope
    print(f"DEBUG CALLBACK: Using FRONTEND_URL='{runtime_frontend_url}' for redirect.")
    # --- END DEBUGGING ---

    # Redirect back to the frontend, indicating success
    # TODO: Make the redirect target configurable
    # Use the variable read within the function scope for consistency in debugging
    redirect_url = f"{runtime_frontend_url}/plan?google_connected=true" # <-- Redirect to /plan page
    return RedirectResponse(redirect_url)

# === Calendar Sync Endpoints ===

# Add a prefix for these calendar-specific actions
calendar_router = APIRouter(
    prefix="/google-calendar",
    dependencies=[Depends(get_current_user)] # Apply auth here
)

@calendar_router.post(
    "/sync-plan/{race_id}",
    status_code=status.HTTP_200_OK,
    summary="Sync Training Plan to Google Calendar"
)
async def sync_plan_to_google_calendar(
    race_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client), # <-- This should use get_supabase_client (authenticated)
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Exports the detailed training plan for a given race to the user's primary Google Calendar."""
    user_id = str(current_user.id)
    
    # 1. Get Refresh Token
    encrypted_refresh_token: Optional[str] = None
    # TODO: Fetch encrypted_refresh_token from 'user_google_auth' table for user_id
    # --- Need Service Client for this internal fetch --- 
    # Ideally, inject service client separately or pass it down
    service_supabase = get_supabase_service_client() # Get service client directly (simpler for now)
    # ---------------------------------------------------
    try:
        response = service_supabase.table("user_google_auth")\
            .select("encrypted_google_refresh_token")\
            .eq("user_id", user_id)\
            .maybe_single()\
            .execute()
        if response.data and response.data.get("encrypted_google_refresh_token"):
            encrypted_refresh_token = response.data["encrypted_google_refresh_token"]
        else:
             raise HTTPException(status_code=401, detail="Google Account not connected or token not found. Please connect your account first.")
    except Exception as e:
        print(f"Error fetching refresh token for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve Google credentials.")

    if not encrypted_refresh_token:
         raise HTTPException(status_code=401, detail="Google Account token invalid or missing.")

    # 2. Get Google Credentials & Service
    credentials = gc_service.get_credentials_from_refresh_token(encrypted_refresh_token)
    if not credentials:
        # Decryption or credential creation failed
        raise HTTPException(status_code=401, detail="Failed to authorize with Google. Please try reconnecting your account.")

    calendar_service = await gc_service.get_calendar_service(credentials)
    if not calendar_service:
        raise HTTPException(status_code=503, detail="Could not connect to Google Calendar service.")

    # 3. Fetch the Training Plan (using the user-authenticated client)
    try:
        response = supabase.table("user_generated_plans")\
            .select("id, generated_plan")\
            .eq("user_id", user_id)\
            .eq("race_id", str(race_id))\
            .maybe_single()\
            .execute()
        
        if not response.data or not response.data.get("generated_plan"):
            raise HTTPException(status_code=404, detail="No saved training plan found for this race.")

        plan_record_id = response.data['id']
        plan_json = response.data["generated_plan"]
        
        # Parse into Pydantic model
        plan = DetailedTrainingPlan.parse_obj(plan_json)

    except HTTPException as e:
        raise e # Re-raise 404 etc.
    except Exception as e:
        print(f"Error fetching/parsing plan for sync (user: {user_id}, race: {race_id}): {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve training plan for syncing.")

    # 4. Iterate and Create Events
    plan_updated = False
    events_synced_count = 0
    for week in plan.weeks:
        for day in week.days:
            # Skip if event already exists or if it's a rest day
            if day.google_event_id or day.workout_type == 'Rest': 
                continue
            
            try:
                event_date_obj = date.fromisoformat(day.date)
                
                # --- Assemble Enhanced Description --- 
                description_parts = []

                # Map workout types to emojis and motivational snippets (customize these!)
                workout_info = {
                    'Easy Run': {'emoji': '👟', 'motivation': 'Focus on conversational pace to build your aerobic base.'},
                    'Tempo Run': {'emoji': '💨', 'motivation': 'Push your threshold, stay comfortably hard!'},
                    'Intervals': {'emoji': '⚡', 'motivation': 'Boost speed and efficiency with these bursts.'},
                    'Speed Work': {'emoji': '🚀', 'motivation': 'Improve your top-end speed and running form.'},
                    'Long Run': {'emoji': '🗺️', 'motivation': 'Build endurance and mental toughness for race day.'},
                    'Rest': {'emoji': '😴', 'motivation': 'Recovery is key! Let your body rebuild.'},
                    'Cross-Training': {'emoji': '🚴', 'motivation': 'Build fitness while giving your running muscles a break.'},
                    'Strength': {'emoji': '🏋️', 'motivation': 'Strengthen supporting muscles to prevent injuries.'},
                    'Race Pace': {'emoji': '🏁', 'motivation': 'Get comfortable with your target race effort.'},
                    'Warm-up': {'emoji': '🔥', 'motivation': 'Prepare your body for the work ahead.'},
                    'Cool-down': {'emoji': '🧊', 'motivation': 'Help your body recover and reduce soreness.'},
                    'Other': {'emoji': '🤔', 'motivation': 'Listen to your body and enjoy the activity!'}
                }
                info = workout_info.get(day.workout_type, workout_info['Other'])
                emoji = info['emoji']
                motivation = info['motivation']

                # Core Info
                description_parts.append(f"{emoji} <b>Workout Type:</b> {day.workout_type}")
                description_parts.append(f"🗓️ <b>Plan Week:</b> {week.week_number}, <b>Day:</b> {day.day_of_week}")
                description_parts.append(f"<br><b>Details:</b> {day.description}") # Main description

                # Metrics
                if day.distance: 
                    description_parts.append(f"📏 <b>Distance:</b> {day.distance}")
                if day.duration: 
                    description_parts.append(f"⏱️ <b>Duration:</b> {day.duration}")
                if day.intensity: 
                    description_parts.append(f"⚡ <b>Intensity:</b> {day.intensity}")

                # Motivation Snippet
                description_parts.append(f"<br>💡 <i>{motivation}</i>") # Italicized

                # Notes from Plan
                if day.notes and day.notes:
                    notes_html = "<ul>" + "".join([f"<li>{note}</li>" for note in day.notes]) + "</ul>"
                    description_parts.append(f"<br>📝 <b>Notes:</b>{notes_html}")

                # Link back & Logging CTA
                # Ensure FRONTEND_URL is accessible here (it's defined at the top of the file)
                plan_url = f"{FRONTEND_URL}/plan" # Link to the main plan page
                description_parts.append(f"<br><br>✅ Remember to log this workout in <a href='{plan_url}'>OurPR</a>!")
                
                # Combine parts with HTML line breaks
                description = "<br>".join(description_parts)
                # -------------------------------------
                
                # Create event
                created_event = await gc_service.create_calendar_event(
                    service=calendar_service,
                    summary=day.workout_type, # Pass workout_type as summary (Title formatting happens in service)
                    description=description, # Pass newly formatted HTML description
                    event_date=event_date_obj,
                    race_name=plan.race_name # Pass the race name
                )
                
                if created_event and created_event.get('id'):
                    day.google_event_id = created_event['id']
                    plan_updated = True
                    events_synced_count += 1
                else:
                    # Log error but continue processing other days
                    print(f"Warning: Failed to create event for date {day.date} for user {user_id}")

            except ValueError: # Handle invalid date format from plan data
                 print(f"Warning: Skipping day with invalid date format '{day.date}' in plan for user {user_id}")
                 continue
            except Exception as e:
                # Log other unexpected errors during event creation
                print(f"Warning: Unexpected error creating event for {day.date} (user: {user_id}): {e}")
                # Potentially stop sync or just continue?
                continue 

    # 5. Save Updated Plan (if any events were added)
    if plan_updated:
        try:
            updated_plan_json = plan.model_dump(mode='json')
            # --- Need service client to update plan IDs --- 
            update_response = service_supabase.table("user_generated_plans")\
                .update({"generated_plan": updated_plan_json})\
                .eq("id", plan_record_id)\
                .execute()
            # ---------------------------------------------------
            
            # Basic check for update success
            if hasattr(update_response, 'error') and update_response.error:
                 print(f"Supabase update error after sync: {update_response.error}")
                 # Don't raise, just log? Sync happened, but IDs not saved.
            else:
                print(f"Successfully saved plan with Google Event IDs for user {user_id}, record {plan_record_id}")

        except Exception as e:
            print(f"Error saving updated plan with event IDs (user: {user_id}, record: {plan_record_id}): {e}")
            # Don't raise an error here? The events are created, just IDs not saved.
            # Maybe return a specific status or message?

    return {"message": f"Plan sync process completed. {events_synced_count} events added to calendar.", "plan_updated_with_ids": plan_updated}

@calendar_router.delete(
    "/sync-plan/{race_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove Synced Plan from Google Calendar"
)
async def remove_plan_from_google_calendar(
    race_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client), # <-- Use authenticated client
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Removes previously synced training plan events from the user's primary Google Calendar."""
    user_id = str(current_user.id)

    # 1. Get Refresh Token (Similar to POST)
    encrypted_refresh_token: Optional[str] = None
    # --- Need Service Client --- 
    service_supabase = get_supabase_service_client()
    # ---------------------------
    try:
        response = service_supabase.table("user_google_auth")\
            .select("encrypted_google_refresh_token")\
            .eq("user_id", user_id)\
            .maybe_single()\
            .execute()
        if response.data and response.data.get("encrypted_google_refresh_token"):
            encrypted_refresh_token = response.data["encrypted_google_refresh_token"]
        else:
             # If no token, assume not connected or already disconnected. Nothing to delete.
             return # Return 204 No Content
    except Exception as e:
        print(f"Error fetching refresh token for delete (user {user_id}): {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve Google credentials.")
    
    # 2. Get Credentials & Service (Similar to POST)
    credentials = gc_service.get_credentials_from_refresh_token(encrypted_refresh_token)
    # If token was invalid/decryption failed, we can't proceed.
    if not credentials: raise HTTPException(status_code=401, detail="Failed to authorize with Google using stored token.")
    calendar_service = await gc_service.get_calendar_service(credentials)
    if not calendar_service: raise HTTPException(status_code=503, detail="Could not connect to Google Calendar service.")

    # 3. Fetch the Training Plan (using authenticated client)
    try:
        response = supabase.table("user_generated_plans")\
            .select("id, generated_plan")\
            .eq("user_id", user_id)\
            .eq("race_id", str(race_id))\
            .maybe_single()\
            .execute()
        if not response.data or not response.data.get("generated_plan"):
            # If no plan, nothing to delete. Return success.
            return # 204 No Content
        plan_record_id = response.data['id']
        plan_json = response.data["generated_plan"]
        plan = DetailedTrainingPlan.parse_obj(plan_json)
    except Exception as e:
        print(f"Error fetching/parsing plan for delete (user: {user_id}, race: {race_id}): {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve training plan for deletion.")

    # 4. Iterate and Delete Events
    plan_updated = False
    events_deleted_count = 0
    for week in plan.weeks:
        for day in week.days:
            if day.google_event_id:
                deleted = await gc_service.delete_calendar_event(
                    service=calendar_service,
                    event_id=day.google_event_id
                )
                if deleted: # If successful deletion or event already gone
                    original_id = day.google_event_id # Keep track for logging
                    day.google_event_id = None
                    plan_updated = True
                    events_deleted_count += 1
                    print(f"Successfully deleted event {original_id} and cleared from plan.")
                else:
                    # Log error but continue trying to delete others
                    print(f"Warning: Failed to delete event {day.google_event_id} for date {day.date} (user: {user_id}) - ID will remain in plan.")
    
    # 5. Save Updated Plan (if any event IDs were removed)
    if plan_updated:
        try:
            updated_plan_json = plan.model_dump(mode='json')
            # --- Need service client to update plan IDs --- 
            update_response = service_supabase.table("user_generated_plans")\
                .update({"generated_plan": updated_plan_json})\
                .eq("id", plan_record_id)\
                .execute()
            # ---------------------------------------------------
            # Log errors if update fails, but don't fail the request
            if hasattr(update_response, 'error') and update_response.error:
                 print(f"Supabase update error after delete sync: {update_response.error}")
            else:
                print(f"Successfully removed {events_deleted_count} Google Event IDs from plan record {plan_record_id} for user {user_id}")
        except Exception as e:
            print(f"Error saving plan after removing event IDs (user: {user_id}, record: {plan_record_id}): {e}")

    # No body needed for 204 response
    return

# === Add Status Check Endpoint ===
@calendar_router.get(
    "/status",
    status_code=status.HTTP_200_OK,
    summary="Check Google Calendar Connection Status"
)
async def check_google_connection_status(
    # No supabase client needed via dependency if using the global one?
    # Or inject service client if preferred
    # supabase: Client = Depends(get_supabase_service_client), 
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Checks if a valid Google refresh token exists for the current user."""
    user_id = str(current_user.id)
    is_connected = False
    
    # Use the globally initialized service client (ensure it's available)
    # Or use the dependency injection approach as commented out above
    if not supabase_service_client:
         print("Warning: Service client not available for status check.")
         # Return false, but this indicates a server config issue
         return {"isConnected": False}

    try:
        response = supabase_service_client.table("user_google_auth")\
            .select("encrypted_google_refresh_token", count='exact')\
            .eq("user_id", user_id)\
            .limit(1)\
            .execute()
        
        # Check if a row exists for the user
        if response.count and response.count > 0:
            # Optional but recommended: Try decrypting the token to ensure it's valid
            token_to_check = response.data[0].get("encrypted_google_refresh_token")
            if token_to_check and gc_service.decrypt_token(token_to_check):
                 is_connected = True
            else:
                print(f"Found token entry for user {user_id}, but token is invalid or decryption failed.")
                # Consider deleting the invalid token row here?
        
    except Exception as e:
        print(f"Error checking Google connection status for user {user_id}: {e}")
        # Don't expose DB error, return false status

    return {"isConnected": is_connected}
# === End Status Check Endpoint ===

# === Add Disconnect Endpoint ===
@calendar_router.delete(
    "/connection",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Disconnect Google Account"
)
async def disconnect_google_account(
    # Use service client to delete the connection info
    supabase: Client = Depends(get_supabase_service_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Deletes the stored Google refresh token for the authenticated user."""
    user_id = str(current_user.id)

    try:
        delete_resp = supabase.table("user_google_auth")\
            .delete()\
            .eq("user_id", user_id)\
            .execute()
        
        # Check if deletion occurred or if the record didn't exist
        # Supabase delete often returns empty data list on success.
        # We can check the count if available or just assume success if no error.
        # count = delete_resp.count if hasattr(delete_resp, 'count') else None
        # print(f"Google connection deletion for user {user_id} count: {count}")
        
        # Log if an error occurred explicitly
        if hasattr(delete_resp, 'error') and delete_resp.error:
            print(f"Error deleting Google connection for user {user_id}: {delete_resp.error}")
            # Don't expose details, return generic server error
            raise HTTPException(status_code=500, detail="Failed to disconnect Google account.")
        
        print(f"Successfully deleted Google connection info for user {user_id}")
        # No response body needed for 204
        return

    except HTTPException as e:
        raise e # Re-raise specific HTTP exceptions
    except Exception as e:
        print(f"Unexpected database error deleting connection for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect Google account due to a server error.")
# === End Disconnect Endpoint ===

# Combine routers if needed, or include them individually in main app
# Example: app.include_router(router, prefix="/api/auth") # Or whatever prefix makes sense
#          app.include_router(calendar_router, prefix="/api/users/me") # Prefix matching frontend calls 