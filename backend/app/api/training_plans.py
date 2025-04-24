import os
import uuid
import json
import google.generativeai as genai
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from gotrue.types import User as SupabaseUser
from pydantic import ValidationError

from ..services.supabase_client import get_supabase_client
from ..models.training_plan import TrainingPlanOutline, WeeklySummary # Import plan models
from ..models.race import Race # Import race model
from ..models.user_pr import UserPr # Import PR model
from .auth import get_current_user # Import auth dependency

# --- Gemini API Configuration (Copied from race_query.py - Consider refactoring to a service) ---
try:
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_api_key:
        print("Warning: GEMINI_API_KEY not found. Training plan generation will fail.")
    else:
        genai.configure(api_key=gemini_api_key)
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    gemini_api_key = None # Ensure it's None if configuration fails
# ----------------------------------------------------------------------------

router = APIRouter(
    prefix="/users/me",
    tags=["Training Plans"],
    dependencies=[Depends(get_current_user)] # Apply auth to all routes in this router
)

# Helper function to format time (could be moved to utils)
def format_time_from_seconds(total_seconds: int) -> str:
    if total_seconds < 0:
        return "N/A"
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    if hours > 0:
        return f"{hours:01}:{minutes:02}:{seconds:02}"
    else:
        return f"{minutes:01}:{seconds:02}"


@router.post(
    "/generate-plan/{race_id}", 
    response_model=TrainingPlanOutline,
    summary="Generate a Basic Training Plan Outline"
)
async def generate_training_plan(
    race_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user) 
):
    """Generates a basic weekly training plan outline using AI based on a 
    planned race and the user's relevant PR.
    """
    user_id = current_user.id

    # 1. Fetch Race Details
    try:
        race_response = supabase.table("races").select("*").eq("id", str(race_id)).maybe_single().execute()
        if not race_response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Race with ID {race_id} not found.")
        race = Race(**race_response.data)
        print(f"Fetched race details for {race.name}")
    except Exception as e:
        print(f"Error fetching race {race_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not fetch race details.")

    # 2. Fetch User's Relevant PR
    user_pr_str = "Not available"
    try:
        if race.distance:
            pr_response = supabase.table("user_prs")\
                .select("*")\
                .eq("user_id", str(user_id))\
                .eq("distance", race.distance)\
                .order("time_in_seconds", desc=False)\
                .limit(1)\
                .maybe_single()\
                .execute()
            
            if pr_response.data:
                user_pr = UserPr(**pr_response.data)
                user_pr_str = format_time_from_seconds(user_pr.time_in_seconds)
                print(f"Fetched relevant PR for {race.distance}: {user_pr_str}")
            else:
                 print(f"No PR found for user {user_id} at distance {race.distance}")
        else:
            print(f"Race {race.name} has no distance specified, cannot fetch relevant PR.")

    except Exception as e:
        # Non-critical error, proceed without PR info if it fails
        print(f"Error fetching PR for user {user_id}, distance {race.distance}: {e}")
        user_pr_str = "Error fetching"

    # 3. Calculate Weeks Until Race
    try:
        if not race.date:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Race date is not set, cannot generate plan.")
        
        # Assume race.date is already a string in 'YYYY-MM-DD' format from the model
        race_date = date.fromisoformat(race.date)
        today = date.today()
        
        if race_date <= today:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Race date is in the past, cannot generate plan.")
             
        weeks_until = (race_date - today).days // 7
        if weeks_until < 1: # Need at least 1 full week
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Race is less than a week away, cannot generate plan.")
        print(f"Weeks until {race.name}: {weeks_until}")
        
    except ValueError:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid race date format.")
    except Exception as e:
        print(f"Error calculating weeks until race: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not determine time until race.")

    # 4. Prepare and Call AI Model (Placeholder Logic)
    if not gemini_api_key:
        raise HTTPException(status_code=503, detail="AI service is not configured.")

    # --- Construct the Prompt --- 
    prompt = f"""
    Generate a basic weekly training plan outline for a runner preparing for the '{race.name}'.
    Race Details:
    - Distance: {race.distance or 'Unknown'}
    - Weeks Until Race: {weeks_until}
    Runner's Personal Record (PR) for {race.distance or 'this distance'}: {user_pr_str}

    Instructions:
    - Provide a week-by-week summary focusing on key workouts and overall goals for each week.
    - Start from Week 1 and go up to Week {weeks_until}.
    - Keep summaries concise.
    - Consider the runner's PR as an indicator of their current fitness level when suggesting paces or intensity (if applicable, otherwise focus on structure).
    - Include a taper period in the final week(s) appropriate for the distance.
    - Structure the output as a JSON object matching the following Pydantic model:
    
    ```json
    {{
      "race_name": "{race.name}",
      "race_distance": "{race.distance or 'Unknown'}",
      "total_weeks": {weeks_until},
      "weeks": [
        {{"week_number": 1, "summary": "Description of week 1..."}},
        {{"week_number": 2, "summary": "Description of week 2..."}},
        ...
        {{"week_number": {weeks_until}, "summary": "Description of final week (taper)..."}}
      ],
      "notes": ["Optional notes like 'Adjust based on feel', 'Remember to warm up', 'Consult a coach for personalized advice.'"]
    }}
    ```

    JSON Output:
    """

    print(f"\n--- Sending Prompt to Gemini for {race.name} ---")
    # print(prompt) # Uncomment to debug the full prompt
    print("---------------------------------------------")

    try:
        model = genai.GenerativeModel('gemini-1.5-flash') 
        response = await model.generate_content_async(prompt)
        
        print(f"Gemini raw response text: {response.text[:500]}...") # Log beginning of response

        # Basic cleanup of the response text
        json_text = response.text.strip().strip('```json').strip('```').strip()
        
        # Parse the JSON string into a Python dict
        parsed_json = json.loads(json_text)
        
        # Validate the dict against the Pydantic model
        plan_outline = TrainingPlanOutline.parse_obj(parsed_json)
        print(f"Successfully parsed training plan from Gemini for {race.name}")
        return plan_outline

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from Gemini: {e}")
        print(f"Faulty JSON text attempt: {json_text}")
        raise HTTPException(status_code=500, detail="AI service returned invalid format.")
    except ValidationError as e:
        print(f"Error validating generated plan against Pydantic model: {e}")
        print(f"Parsed JSON attempt: {parsed_json}")
        raise HTTPException(status_code=500, detail="AI service generated incompatible plan structure.")
    except Exception as e:
        print(f"Error calling Gemini API for plan generation: {e}")
        # Attempt to capture more specific Gemini errors if possible
        error_detail = f"Error generating plan with AI service: {e}"
        if hasattr(e, 'message'): error_detail = e.message # Use specific message if available
        raise HTTPException(status_code=500, detail=error_detail) 