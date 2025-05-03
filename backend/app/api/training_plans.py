import os
import uuid
import json
import google.generativeai as genai
from datetime import date, timedelta, datetime
import re # <-- Import regex module

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from gotrue.types import User as SupabaseUser
from pydantic import ValidationError, BaseModel

from ..services.supabase_client import get_supabase_client
from ..models.training_plan import (
    TrainingPlanOutline, WeeklySummary,
    DetailedTrainingPlan, DetailedWeek, DailyWorkout,
    DailyWorkoutStatusUpdate
)
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

# --- Helper function to get the Monday of a given week offset ---
def get_monday_of_week(target_date: date, weeks_offset: int) -> date:
    """Calculates the date of the Monday 'weeks_offset' weeks before the week containing target_date."""
    # Find the Monday of the week containing the target_date
    monday_of_target_week = target_date - timedelta(days=target_date.weekday())
    # Subtract the offset in weeks
    start_monday = monday_of_target_week - timedelta(weeks=weeks_offset)
    return start_monday
# -------------------------------------------------------------

@router.post(
    "/generate-plan/{race_id}",
    response_model=DetailedTrainingPlan,
    summary="Generate a Detailed Daily Training Plan"
)
async def generate_training_plan(
    race_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Generates a detailed **daily** training plan using AI based on a
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

    # 3. Calculate Weeks Until Race and Plan Start Date
    try:
        if not race.date:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Race date is not set, cannot generate plan.")
        
        # Assume race.date is already a string in 'YYYY-MM-DD' format from the model
        race_date_obj = date.fromisoformat(race.date)
        today = date.today()
        
        if race_date_obj <= today:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Race date is in the past, cannot generate plan.")
             
        # Calculate total weeks needed for the plan
        # Plan ends on the Sunday *before* race week
        day_before_race = race_date_obj - timedelta(days=1)
        sunday_before_race = day_before_race - timedelta(days=day_before_race.weekday() + 1) # +1 because Sunday is 6, weekday() is 0-6
        
        # Calculate the first Monday of the plan
        # This depends on when the user generates it. Let's align it with weeks_until calculation for now.
        # Monday of the current week
        monday_this_week = today - timedelta(days=today.weekday())
        
        # Calculate full weeks between Monday of this week and Sunday before race week
        weeks_until = (sunday_before_race - monday_this_week).days // 7 + 1 # Add 1 because it's inclusive

        if weeks_until < 1:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough time before the race for a plan.")

        # Calculate the actual start date of the plan (Monday of the first week)
        # Plan starts 'weeks_until' weeks before the week of the race
        plan_start_date_obj = get_monday_of_week(race_date_obj, weeks_until)
        plan_start_date_str = plan_start_date_obj.isoformat()

        print(f"Race Date: {race.date}, Today: {today.isoformat()}")
        print(f"Sunday before race: {sunday_before_race.isoformat()}")
        print(f"Plan Start Date (Monday): {plan_start_date_str}")
        print(f"Total Plan Weeks: {weeks_until}")

    except ValueError:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid race date format.")
    except Exception as e:
        print(f"Error calculating dates: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not calculate plan dates.")

    # 4. Prepare and Call AI Model
    if not gemini_api_key:
        raise HTTPException(status_code=503, detail="AI service is not configured.")

    # --- Construct the DETAILED Prompt ---
    prompt = f"""
    Act as an expert running coach creating a **detailed, day-by-day** training plan for a runner preparing for the '{race.name}'.

    Race Details:
    - Distance: {race.distance or 'Unknown'}
    - Race Date: {race.date}
    - Total Plan Weeks: {weeks_until}
    Runner's Personal Record (PR) for {race.distance or 'this distance'}: {user_pr_str}

    Instructions:
    - Provide a plan starting from Week 1 up to Week {weeks_until}.
    - For each week, provide:
        - A `weekly_focus` string (e.g., "Base building", "Peak mileage", "Taper").
        - An `estimated_weekly_mileage` string (e.g., "25-30 miles").
        - A `days` array containing exactly 7 objects, one for each day (Monday to Sunday).
    - For each day object within the `days` array, provide:
        - `day_of_week`: string ("Monday", "Tuesday", ..., "Sunday").
        - `workout_type`: string (Choose from: 'Easy Run', 'Tempo Run', 'Intervals', 'Speed Work', 'Long Run', 'Rest', 'Cross-Training', 'Strength', 'Race Pace', 'Warm-up', 'Cool-down', 'Other').
        - `description`: string (Clear instruction, e.g., "4 miles at conversational pace", "Rest day", "45 min cycling - easy effort", "6x400m @ 5K pace w/ 400m jog recovery").
        - `distance`: Optional string (e.g., "4 miles", "800 meters").
        - `duration`: Optional string (e.g., "30 minutes", "1 hour").
        - `intensity`: Optional string (e.g., "Easy", "Conversational", "Tempo", "5K Pace", "HR Zone 2").
        - `notes`: Optional array of strings (short tips or variations, e.g., ["Focus on form", "Listen to your body"]).
    - Ensure a logical progression: build mileage gradually, include key workouts (long run, intensity), incorporate rest/recovery (at least 1-2 rest days/week), and a taper (1-3 weeks).
    - The long run should typically be on Saturday or Sunday.
    - Adapt the plan intensity/volume based on the race distance and the provided PR ({user_pr_str}). If PR is unavailable, assume intermediate fitness. Focus on safe progression.
    - Include `overall_notes` as an array of general advice strings.
    - Structure the output strictly as a JSON object matching this **target structure** (Do NOT include date or status fields for days, Python will add them):

    ```json
    {{
      "race_name": "{race.name}",
      "race_distance": "{race.distance or 'Unknown'}",
      "total_weeks": {weeks_until},
      "weeks": [
        // Week 1 Example
        {{
          "week_number": 1,
          "weekly_focus": "Initial base building and consistency",
          "estimated_weekly_mileage": "15-20 miles",
          "days": [
            {{"day_of_week": "Monday", "workout_type": "Rest", "description": "Rest day"}},
            {{"day_of_week": "Tuesday", "workout_type": "Easy Run", "description": "3 miles at conversational pace", "distance": "3 miles", "intensity": "Easy"}},
            {{"day_of_week": "Wednesday", "workout_type": "Easy Run", "description": "4 miles easy", "distance": "4 miles", "intensity": "Easy"}},
            {{"day_of_week": "Thursday", "workout_type": "Rest", "description": "Rest or optional light cross-training (30 min)"}},
            {{"day_of_week": "Friday", "workout_type": "Easy Run", "description": "3 miles easy", "distance": "3 miles", "intensity": "Easy"}},
            {{"day_of_week": "Saturday", "workout_type": "Long Run", "description": "6 miles at easy, conversational pace", "distance": "6 miles", "intensity": "Easy"}},
            {{"day_of_week": "Sunday", "workout_type": "Rest", "description": "Rest day"}}
          ]
        }},
        // ... more weeks ...
        // Week {weeks_until} Example (Taper)
        {{
           "week_number": {weeks_until},
           "weekly_focus": "Taper - Race Week Prep",
           "estimated_weekly_mileage": "8-12 miles",
           "days": [
                {{"day_of_week": "Monday", "workout_type": "Rest", "description": "Rest day"}},
                {{"day_of_week": "Tuesday", "workout_type": "Easy Run", "description": "2 miles very easy shakeout", "distance": "2 miles", "intensity": "Very Easy"}},
                // ... etc for taper week ...
                {{"day_of_week": "Sunday", "workout_type": "Other", "description": "RACE DAY!"}} // Or maybe Race is outside the plan scope? Clarify if race day itself is part of the last week's days. Let's assume plan ends *before* race day. -> Plan ends Sunday before race.
           ]
        }}
      ],
      "overall_notes": ["Hydrate well throughout the plan.", "Listen to your body.", "Fuel appropriately for your runs."]
    }}
    ```

    JSON Output:
    """

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = await model.generate_content_async(prompt)
        raw_text = response.text

        # --- JSON Extraction ---
        json_match = re.search(r"```json\n({.*?})\n```", raw_text, re.DOTALL | re.MULTILINE)
        if json_match:
            json_text = json_match.group(1).strip()
        else:
            print("Warning: Could not find ```json block, attempting basic strip.")
            json_text = raw_text.strip().strip('```json').strip('```').strip()
            if not json_text.startswith('{') or not json_text.endswith('}'):
                 print(f"Error: Stripped text doesn't look like JSON: {json_text[:100]}...")
                 raise json.JSONDecodeError("Failed to extract valid JSON block from AI response.", raw_text, 0)

        # Parse the JSON string into a Python dict (basic structure from AI)
        ai_parsed_data = json.loads(json_text)

        # --- Construct the Full DetailedTrainingPlan Object ---
        detailed_weeks_data = []
        current_monday = plan_start_date_obj

        ai_weeks = ai_parsed_data.get("weeks", [])
        if len(ai_weeks) != weeks_until:
             print(f"Warning: AI returned {len(ai_weeks)} weeks, expected {weeks_until}. Using AI weeks.")
             # Adjust total_weeks if necessary, or raise error? For now, use AI's count.
             # Let's trust the original weeks_until calculation for date iteration
             # raise HTTPException(status_code=500, detail=f"AI returned incorrect number of weeks ({len(ai_weeks)} vs {weeks_until}).")

        # Ensure weeks are sorted by week_number from AI data just in case
        ai_weeks.sort(key=lambda w: w.get("week_number", 0))

        for week_index in range(weeks_until):
            if week_index >= len(ai_weeks):
                print(f"Error: Missing week {week_index + 1} data from AI. Stopping plan construction.")
                # Or attempt to fill with rest days? For now, stop.
                raise HTTPException(status_code=500, detail=f"AI response missing data for week {week_index + 1}.")

            ai_week = ai_weeks[week_index]
            actual_week_number = week_index + 1 # Use calculated index for consistency
            
            # Verify week number match if present in AI data
            if ai_week.get("week_number") is not None and ai_week["week_number"] != actual_week_number:
                 print(f"Warning: AI week number mismatch (AI: {ai_week['week_number']}, Expected: {actual_week_number}). Using expected.")
                 
            week_start_date = current_monday
            week_end_date = week_start_date + timedelta(days=6)
            detailed_days_data = []
            
            ai_days = ai_week.get("days", [])
            if len(ai_days) != 7:
                 raise HTTPException(status_code=500, detail=f"AI returned {len(ai_days)} days for week {actual_week_number}, expected 7.")

            # Define expected order for safety, although AI should return ordered
            day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            # Simple sort based on expected order (handles potential AI reordering)
            ai_days_sorted = sorted(ai_days, key=lambda d: day_order.index(d.get("day_of_week", "")))

            for day_index, ai_day in enumerate(ai_days_sorted):
                current_date = week_start_date + timedelta(days=day_index)
                # Basic validation of day data
                if not all(k in ai_day for k in ["day_of_week", "workout_type", "description"]):
                     raise HTTPException(status_code=500, detail=f"AI response missing required fields for day {day_index+1} in week {actual_week_number}.")
                
                # Check if AI day_of_week matches calculated position
                expected_day_name = day_order[day_index]
                if ai_day["day_of_week"] != expected_day_name:
                    print(f"Warning: Day of week mismatch in week {actual_week_number} (AI: {ai_day['day_of_week']}, Expected: {expected_day_name}). Using AI value.")

                day_data = {
                    "date": current_date.isoformat(),
                    "status": "pending", # Default status
                    **ai_day # Add all fields from the AI response for this day
                }
                detailed_days_data.append(day_data)

            week_data = {
                "week_number": actual_week_number,
                "start_date": week_start_date.isoformat(),
                "end_date": week_end_date.isoformat(),
                "days": detailed_days_data,
                "weekly_focus": ai_week.get("weekly_focus"),
                "estimated_weekly_mileage": ai_week.get("estimated_weekly_mileage")
            }
            detailed_weeks_data.append(week_data)

            # Advance to the next Monday
            current_monday += timedelta(weeks=1)

        # Construct the final plan object dictionary
        plan_data = {
            "user_id": str(user_id),
            "race_name": ai_parsed_data.get("race_name", race.name), # Use AI or fallback
            "race_distance": ai_parsed_data.get("race_distance", race.distance or "Unknown"),
            "race_date": race.date, # Use original fetched date string
            "goal_time": None, # AI currently doesn't set this
            "plan_start_date": plan_start_date_str,
            "total_weeks": weeks_until, # Use calculated value
            "weeks": detailed_weeks_data,
            "overall_notes": ai_parsed_data.get("overall_notes"),
            "personalization_details": {"pr_used": f"{race.distance} PR: {user_pr_str}"} if user_pr_str != "Not available" and user_pr_str != "Error fetching" else None,
            # plan_id, generated_at, plan_version will be set by Pydantic model defaults
        }

        # Validate the final constructed dict against the Pydantic model
        detailed_plan = DetailedTrainingPlan.parse_obj(plan_data)
        print(f"Successfully generated and validated detailed plan for {detailed_plan.race_name}")
        return detailed_plan

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from Gemini: {e}")
        print(f"Faulty JSON text attempt: {json_text if 'json_text' in locals() else '[Could not extract]'}")
        raise HTTPException(status_code=500, detail=f"AI service returned invalid format. {e.msg}")
    except ValidationError as e:
        print(f"Error validating generated plan against Pydantic model: {e}")
        # Log the data that failed validation
        print(f"Data causing validation error: {plan_data if 'plan_data' in locals() else ai_parsed_data if 'ai_parsed_data' in locals() else '[Data unavailable]'}")
        raise HTTPException(status_code=500, detail="Generated plan structure is incompatible.")
    except HTTPException as e: # Re-raise known HTTP exceptions
        raise e
    except Exception as e:
        print(f"Unexpected error during detailed plan generation: {e}")
        import traceback
        traceback.print_exc() # Print full traceback for debugging unexpected errors
        error_detail = f"Error generating detailed plan: {e}"
        raise HTTPException(status_code=500, detail=error_detail)

# Simple response model for save endpoint
class UserGeneratedPlanResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    race_id: uuid.UUID

@router.post(
    "/races/{race_id}/generated-plan",
    status_code=status.HTTP_201_CREATED,
    summary="Save a Generated Detailed Training Plan",
    response_model=UserGeneratedPlanResponse
)
async def save_generated_plan(
    race_id: uuid.UUID,
    detailed_plan: DetailedTrainingPlan,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Saves a generated detailed training plan for the user and specified race."""
    user_id = current_user.id

    # Ensure the user_id in the plan matches the authenticated user
    if detailed_plan.user_id != str(user_id):
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Plan user ID does not match authenticated user.")

    # Convert Pydantic model to dict for Supabase
    plan_json = detailed_plan.model_dump(mode='json')

    insert_data = {
        "user_id": str(user_id),
        "race_id": str(race_id),
        "generated_plan": plan_json,
        # Consider adding plan_version, generated_at to the table schema for easier querying?
        # "plan_version": detailed_plan.plan_version,
        # "generated_at_ts": detailed_plan.generated_at
    }

    try:
        # Use upsert to handle potential conflicts
        response = supabase.table("user_generated_plans")\
            .upsert(insert_data, on_conflict="user_id, race_id")\
            .execute()

        if not response.data:
            print(f"Upsert failed for user {user_id}, race {race_id}. Response: {response}")
            raise HTTPException(status_code=500, detail="Failed to save training plan.")

        saved_data = response.data[0]
        return UserGeneratedPlanResponse(id=saved_data['id'], user_id=saved_data['user_id'], race_id=saved_data['race_id'])

    except Exception as e:
        print(f"Error saving generated plan for user {user_id}, race {race_id}: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while saving the plan.")

@router.get(
    "/races/{race_id}/generated-plan",
    response_model=DetailedTrainingPlan,
    summary="Get Saved Detailed Training Plan",
    responses={404: {"detail": "No saved plan found for this race."}}
)
async def get_saved_plan(
    race_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Retrieves a previously saved generated detailed training plan for the user and specified race."""
    user_id = current_user.id

    try:
        response = supabase.table("user_generated_plans")\
            .select("generated_plan")\
            .eq("user_id", str(user_id))\
            .eq("race_id", str(race_id))\
            .maybe_single()\
            .execute()

        if not response.data or not response.data.get("generated_plan"):
            raise HTTPException(status_code=404, detail="No saved plan found for this race.")

        plan_data = response.data["generated_plan"]

        # Validate against the DETAILED model before returning
        # Add robustness: check if it LOOKS like a detailed plan vs old outline?
        # For now, assume it's the new format if found.
        # Add a version field check if that was added to the table.
        return DetailedTrainingPlan.parse_obj(plan_data)

    except HTTPException as e: # Re-raise 404
        raise e
    except ValidationError as e:
        print(f"Error validating saved detailed plan data for user {user_id}, race {race_id}: {e}")
        # Maybe return the old format if validation as new one fails? Or just error.
        raise HTTPException(status_code=500, detail="Saved plan data is invalid or in an old format.")
    except Exception as e:
        print(f"Error fetching saved plan for user {user_id}, race {race_id}: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while fetching the saved plan.")

# --- Endpoint to Update Daily Workout Status --- 

@router.patch(
    "/races/{race_id}/plan/days/{day_date}",
    status_code=status.HTTP_200_OK,
    summary="Update Status of a Specific Daily Workout",
    response_model=DailyWorkout # Return the updated workout day
)
async def update_daily_workout_status(
    race_id: uuid.UUID,
    day_date: str, # Expecting "YYYY-MM-DD" format from the path
    status_update: DailyWorkoutStatusUpdate, # Request body with the new status
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Updates the status ('pending', 'completed', 'skipped') of a specific workout 
    within a user's saved detailed training plan.
    """
    user_id = str(current_user.id)
    new_status = status_update.status

    # 1. Validate the date format (basic check)
    try:
        date.fromisoformat(day_date)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Use YYYY-MM-DD.")

    # 2. Fetch the existing saved plan JSON
    try:
        response = supabase.table("user_generated_plans")\
            .select("id, generated_plan")\
            .eq("user_id", user_id)\
            .eq("race_id", str(race_id))\
            .maybe_single()\
            .execute()
        
        if not response.data or not response.data.get("generated_plan"):
            raise HTTPException(status_code=404, detail="No saved plan found for this race to update.")

        plan_record_id = response.data['id']
        plan_json = response.data["generated_plan"]
        
        # Parse the stored JSON into our Pydantic model for easier manipulation
        try:
            # Use parse_obj for dict -> model
            plan = DetailedTrainingPlan.parse_obj(plan_json)
        except ValidationError as val_err:
            print(f"Validation error parsing stored plan JSON for user {user_id}, race {race_id}: {val_err}")
            raise HTTPException(status_code=500, detail="Failed to parse stored plan data.")

    except HTTPException as http_exc: # Re-raise 404 etc.
        raise http_exc
    except Exception as e:
        print(f"Error fetching plan for update for user {user_id}, race {race_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve plan for update.")

    # 3. Find the specific day and update its status
    updated_day_data = None
    found_day = False
    for week in plan.weeks:
        for day in week.days:
            if day.date == day_date:
                if day.status == new_status:
                    # Status is already the target status, maybe return 200 or 304? Let's just return 200.
                    print(f"Workout status for {day_date} is already '{new_status}'. No update needed.")
                    updated_day_data = day # Return the existing day data
                    found_day = True
                    break 
                
                day.status = new_status
                updated_day_data = day # Store the modified day object to return
                found_day = True
                print(f"Updated status for day {day_date} to {new_status}")
                break # Found the day, exit inner loop
        if found_day:
            break # Exit outer loop as well

    if not found_day:
        raise HTTPException(status_code=404, detail=f"Workout for date {day_date} not found within the plan.")

    # 4. Save the modified plan back to Supabase
    try:
        # Convert the updated Pydantic model back to a dict/JSON for storage
        updated_plan_json = plan.model_dump(mode='json')
        
        update_response = supabase.table("user_generated_plans")\
            .update({"generated_plan": updated_plan_json})\
            .eq("id", plan_record_id)\
            .execute()
        
        # Check response, Supabase update returns data list if successful, even if empty
        # Check for errors in the response if available/needed
        if hasattr(update_response, 'error') and update_response.error:
             print(f"Supabase update error: {update_response.error}")
             raise Exception("Supabase update failed.")
        # Or check if data is None or empty if that indicates error
        # if not update_response.data: # This check might be too strict? Check Supabase docs for update response.
        #     print(f"Update seems to have failed for record {plan_record_id}")
        #     raise Exception("Update operation returned no data.")

        print(f"Successfully saved updated plan for record ID {plan_record_id}")

    except Exception as e:
        print(f"Error saving updated plan for user {user_id}, race {race_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to save updated workout status.")

    # 5. Return the updated daily workout object
    return updated_day_data

# --- Endpoint to Update the Entire Plan Structure (e.g., after shifting days) ---

@router.patch(
    "/races/{race_id}/generated-plan", # Using PATCH on the existing resource URL
    status_code=status.HTTP_200_OK,
    summary="Update the structure of a Saved Detailed Training Plan",
    response_model=DetailedTrainingPlan # Return the updated plan
)
async def update_saved_plan_structure(
    race_id: uuid.UUID,
    updated_plan: DetailedTrainingPlan, # Expect the full updated plan in the body
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Updates the entire saved detailed training plan structure for a user and race.
    Used after client-side modifications like rearranging workout days.
    """
    user_id = str(current_user.id)

    # 1. Basic Validation
    # Ensure the user ID in the submitted plan matches the authenticated user
    if updated_plan.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Plan user ID does not match authenticated user.")
    # Ensure the race ID from the path roughly corresponds if needed (though plan might not store it)
    # Optional: Add more validation on the structure if necessary (e.g., still 7 days per week?)

    # 2. Convert updated plan to JSON for storage
    try:
        updated_plan_json = updated_plan.model_dump(mode='json')
    except Exception as e:
        # This shouldn't happen if Pydantic validation passed on input
        print(f"Error serializing updated plan: {e}")
        raise HTTPException(status_code=500, detail="Failed to prepare plan data for saving.")

    # 3. Update the database record
    try:
        response = supabase.table("user_generated_plans")\
            .update({"generated_plan": updated_plan_json})\
            .eq("user_id", user_id)\
            .eq("race_id", str(race_id))\
            .execute()

        # Check for errors during update
        # Supabase update might return an empty data list on success, focus on errors
        if hasattr(response, 'error') and response.error:
             print(f"Supabase plan structure update error: {response.error}")
             raise Exception("Supabase update failed.")
        
        # Optional: Check if any rows were actually updated if needed
        # count = response.count if hasattr(response, 'count') else None
        # if count == 0:
        #     raise HTTPException(status_code=404, detail="No matching plan found to update.")

        print(f"Successfully updated plan structure for user {user_id}, race {race_id}")

    except HTTPException as http_exc:
        raise http_exc # Re-raise specific exceptions like 404 if implemented above
    except Exception as e:
        print(f"Error updating plan structure in DB for user {user_id}, race {race_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to save updated plan structure.")

    # 4. Return the updated plan (as received and validated)
    return updated_plan 