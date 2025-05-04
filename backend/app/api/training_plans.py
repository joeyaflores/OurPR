import os
import uuid
import json
import google.generativeai as genai
from datetime import date, timedelta, datetime
import re # <-- Import regex module
from typing import Optional, Literal # <-- Import Optional & Literal

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from gotrue.types import User as SupabaseUser
from pydantic import ValidationError, BaseModel

from ..services.supabase_client import get_supabase_client
from ..models.training_plan import (
    TrainingPlanOutline, WeeklySummary,
    DetailedTrainingPlan, DetailedWeek, DailyWorkout,
    DailyWorkoutStatusUpdate,
    WorkoutAnalysisRequest, WorkoutAnalysisResponse, PlanContextForAnalysis # <-- Import new models
)
from ..models.race import Race # Import race model
from ..models.user_pr import UserPr # Import PR model
from .auth import get_current_user # Import auth dependency

# --- Updated Request Body Model --- 
class PlanGenerationRequest(BaseModel):
    goal_time: Optional[str] = None
    current_weekly_mileage: Optional[int] = None
    peak_weekly_mileage: Optional[int] = None
    preferred_running_days: Optional[Literal[3, 4, 5, 6]] = None # Limit options
    preferred_long_run_day: Optional[Literal['Saturday', 'Sunday']] = None # Limit options
# --------------------------------

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
    request_data: PlanGenerationRequest, # <-- Add request body parameter
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Generates a detailed **daily** training plan using AI based on a
    planned race, the user's relevant PR, and optional user preferences.
    """
    user_id = current_user.id
    
    # --- Extract data from request body --- 
    user_goal_time_str = request_data.goal_time or "Not specified"
    current_mileage_str = f"{request_data.current_weekly_mileage} miles/week" if request_data.current_weekly_mileage else "Not specified"
    peak_mileage_str = f"{request_data.peak_weekly_mileage} miles/week" if request_data.peak_weekly_mileage else "Not specified"
    running_days_str = f"{request_data.preferred_running_days} days/week" if request_data.preferred_running_days else "Not specified"
    long_run_day_str = request_data.preferred_long_run_day or "Weekend (Sat/Sun preferred)" 
    # -------------------------------------

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

        # --- Add Maximum Weeks Check ---
        MAX_PLAN_WEEKS = 20
        if weeks_until > MAX_PLAN_WEEKS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Training plans cannot be generated for more than {MAX_PLAN_WEEKS} weeks. Please choose a race closer to the current date."
            )
        # -----------------------------

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

    # --- Construct the ENHANCED Prompt --- 
    prompt = f"""
    Act as an expert running coach creating a **detailed, day-by-day** training plan for a runner preparing for the '{race.name}'.

    Race Details:
    - Distance: {race.distance or 'Unknown'}
    - Race Date: {race.date}
    - Total Plan Weeks: {weeks_until}

    Runner's Context:
    - Personal Record (PR) for {race.distance or 'this distance'}: {user_pr_str}
    - Goal Time: {user_goal_time_str}
    - Current Weekly Mileage: {current_mileage_str}
    - Target Peak Weekly Mileage: {peak_mileage_str}
    - Preferred Running Days per Week: {running_days_str}
    - Preferred Long Run Day: {long_run_day_str}

    Instructions:
    - Provide a plan starting from Week 1 up to Week {weeks_until}, structured as a JSON object matching the target structure below.
    - For each week, provide:
        - `week_number`
        - `weekly_focus`
        - `estimated_weekly_mileage` (string): **This MUST accurately reflect the sum of distances from the `days` array for that week.** For example, if the daily distances add up to 61 miles, the estimate should be '~61 miles' or '60-62 miles'.
        - A `days` array.
    - **Each `days` array MUST contain exactly 7 day objects, one for each day from Monday to Sunday.**
    - For each day object **within the `days` array**, you **MUST** provide the following fields:
        - `day_of_week`: **MUST contain the string name** for the day (e.g., "Monday", "Tuesday", ..., "Sunday"). **IT CANNOT BE EMPTY OR A WORKOUT TYPE.**
        - `workout_type`: **MUST contain *exactly* one** of the following allowed strings: 'Easy Run', 'Tempo Run', 'Intervals', 'Speed Work', 'Long Run', 'Rest', 'Cross-Training', 'Strength', 'Race Pace', 'Warm-up', 'Cool-down', 'Other'. **IT CANNOT BE A DAY NAME OR CONTAIN EXTRA DESCRIPTIONS.**
        - `description`: A string detailing the workout (e.g., "4 miles conversational pace + 4x100m strides"). Put combined activities/details here.
        - Optional: `distance` (string), `duration` (string), `intensity` (string), `notes` (array of strings).
        - **Include calculated pace suggestions (e.g., in min/mile) within the `description` for relevant workouts (Tempo, Intervals, Speed Work, Race Pace). Optionally include pace ranges for Easy/Long runs.** Base paces on the Runner's Context (PR, Goal Time). **Provide paces ONLY in minutes per mile (min/mile) format.**
    - **Crucially, tailor the plan using ALL the provided 'Runner's Context':**
        - Base the starting weekly mileage and initial long run distance on the 'Current Weekly Mileage'. If not specified, assume a reasonable starting point for the race distance.
        - Gradually build weekly volume towards the 'Target Peak Weekly Mileage'. Adjust the target peak if it seems unrealistic (too high or too low for the race distance/duration) and note the adjustment in `overall_notes`.
        - Distribute the running workouts across the 'Preferred Running Days per Week'. If not specified, use a standard 4-5 days of running. Schedule rest or cross-training on the remaining days (aim for 1-2 full rest days minimum).
        - Schedule the weekly 'Long Run' on the 'Preferred Long Run Day'. If flexible or not specified, choose Saturday or Sunday.
        - Adapt intensity/volume based on the race distance, PR, AND Goal Time. Tailor paces for key workouts (tempo, intervals) towards the Goal Time, using the PR as a baseline.
        - If the Goal Time seems very ambitious compared to the PR, create a challenging but realistic plan. Note the goal's difficulty in `overall_notes`.
        - If Goal Time is 'Not specified', generate a plan based primarily on PR and other preferences.
        - Ensure logical progression, safe mileage increases, and a 1-3 week taper.
    - Include `overall_notes` as an array of general advice strings, including any notes about adjustments made based on runner context.
    - **For the actual Race Day event itself (usually the last Sunday), use `workout_type: \'Other\'` and set the `description` to something like "RACE DAY! {{Race Name}}".**
    - **IMPORTANT:** The output **MUST** be a single JSON object enclosed in ```json ... ```. 
    - **DO NOT** include any comments (like `// ...`) or explanatory text *within* the JSON structure itself. All explanations or notes about adjustments should be in the `overall_notes` array.
    - Ensure **all** weeks from 1 to {weeks_until} are present in the `weeks` array, each with a fully defined `days` array containing 7 day objects.

    Target JSON Structure (Example Snippets - Adhere strictly to this format):
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
          "estimated_weekly_mileage": "15-20 miles", // Reflects starting point
          "days": [
            {{"day_of_week": "Monday", "workout_type": "Rest", "description": "Rest day"}}, // Based on preferred days
            {{"day_of_week": "Tuesday", "workout_type": "Easy Run", "description": "3 miles conversational", "distance": "3 miles", "intensity": "Easy"}},
            {{"day_of_week": "Wednesday", "workout_type": "Rest", "description": "Rest or 30min Cross-Training"}},
            {{"day_of_week": "Thursday", "workout_type": "Easy Run", "description": "4 miles easy", "distance": "4 miles"}},
            {{"day_of_week": "Friday", "workout_type": "Rest", "description": "Rest day"}},
            {{"day_of_week": "Saturday", "workout_type": "Long Run", "description": "6 miles easy pace", "distance": "6 miles"}}, // Based on preferred day
            {{"day_of_week": "Sunday", "workout_type": "Easy Run", "description": "3 miles easy", "distance": "3 miles"}}
          ]
        }},
        // ... more weeks ...
      ],
      "overall_notes": ["Hydrate well.", "Listen to your body.", "Adjusted peak mileage slightly based on race distance."]
    }}
    ```

    JSON Output:
    """

    try:
        model = genai.GenerativeModel('gemini-2.5-flash-preview-04-17')
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

        # --- Pre-processing: Ensure day_of_week is correct before sorting/validation ---
        day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        allowed_workout_types = {'Easy Run', 'Tempo Run', 'Intervals', 'Speed Work', 'Long Run', 'Rest', 'Cross-Training', 'Strength', 'Race Pace', 'Warm-up', 'Cool-down', 'Other'}
        try:
            for week_data in ai_parsed_data.get("weeks", []):
                days_list = week_data.get("days", [])
                if len(days_list) != 7:
                    print(f"Warning: AI returned {len(days_list)} days for week {week_data.get('week_number', '?')}, expected 7. Skipping week correction.")
                    continue # Skip correction if day count is wrong
                for index, day_object in enumerate(days_list):
                    week_num_str = f"week {week_data.get('week_number', '?')}"
                    day_index_str = f"day index {index}"
                    
                    # 1. Correct day_of_week
                    current_day_name = day_object.get("day_of_week")
                    correct_day_name = day_order[index] # Expected name based on index (0=Monday, etc.)
                    if not current_day_name or current_day_name not in day_order:
                        print(f"Warning: Correcting invalid day_of_week '{current_day_name}' to '{correct_day_name}' for {week_num_str} {day_index_str}")
                        day_object["day_of_week"] = correct_day_name
                    
                    # 2. Correct workout_type (if missing or invalid)
                    current_workout_type = day_object.get("workout_type")
                    if not current_workout_type or current_workout_type not in allowed_workout_types:
                         corrected_type = 'Other' # Default correction
                         print(f"Warning: Correcting invalid workout_type '{current_workout_type}' to '{corrected_type}' for {week_num_str} {day_index_str}")
                         day_object["workout_type"] = corrected_type
                         current_workout_type = corrected_type # Use corrected type for description check
                    
                    # 3. Add default description if missing
                    current_description = day_object.get("description")
                    if not current_description:
                         # Provide a sensible default based on the (potentially corrected) workout type
                         default_desc = current_workout_type if current_workout_type != 'Other' else 'Workout' 
                         print(f"Warning: Adding default description '{default_desc}' for missing description for {week_num_str} {day_index_str}")
                         day_object["description"] = default_desc

        except IndexError as e:
            # This might happen if AI returns > 7 days somehow
            print(f"Error during day_of_week correction preprocessing: {e}. Index likely out of bounds.")
            # Depending on severity, could raise HTTPException here, but let Pydantic catch it later for now
            pass
        except Exception as e:
            print(f"Unexpected error during day_of_week correction: {e}")
            pass # Let Pydantic validation handle deeper structure issues
        # --- End Pre-processing ---

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
            "goal_time": user_goal_time_str,
            "plan_start_date": plan_start_date_str,
            "total_weeks": weeks_until, # Use calculated value
            "weeks": detailed_weeks_data,
            "overall_notes": ai_parsed_data.get("overall_notes"),
            # --- Populate personalization_details with actual inputs used --- 
            "personalization_details": {
                 "pr_used": f"{race.distance} PR: {user_pr_str}" if user_pr_str not in ["Not available", "Error fetching"] else None,
                 "goal_time_set": request_data.goal_time if request_data.goal_time else None,
                 "current_mileage_input": request_data.current_weekly_mileage if request_data.current_weekly_mileage else None,
                 "peak_mileage_input": request_data.peak_weekly_mileage if request_data.peak_weekly_mileage else None,
                 "running_days_input": request_data.preferred_running_days if request_data.preferred_running_days else None,
                 "long_run_day_input": request_data.preferred_long_run_day if request_data.preferred_long_run_day else None,
             },
            # plan_id, generated_at, plan_version will be set by Pydantic model defaults
        }

        # Filter out None values from personalization_details before validation
        plan_data["personalization_details"] = {k: v for k, v in plan_data["personalization_details"].items() if v is not None}
        if not plan_data["personalization_details"]:
             plan_data["personalization_details"] = None # Set to None if empty

        # Validate the final constructed dict against the Pydantic model
        detailed_plan = DetailedTrainingPlan.parse_obj(plan_data)
        print(f"Successfully generated and validated detailed plan for {detailed_plan.race_name} with goal {detailed_plan.goal_time}") # <-- Log goal time
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
    responses={
        404: {"detail": "No saved plan found for this race."},
        409: {"detail": "Saved plan is in an outdated format. Please delete and regenerate."},
        500: {"detail": "Saved plan data is invalid or server error."}
    }
)
async def get_saved_plan(
    race_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Retrieves a previously saved generated detailed training plan for the user and specified race.
       Handles outdated plan formats by returning a specific error.
    """
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

        # Attempt to parse as the NEW DetailedTrainingPlan first
        try:
            detailed_plan = DetailedTrainingPlan.parse_obj(plan_data)
            # If successful, return it
            return detailed_plan
        except ValidationError as detailed_exc:
            # Parsing as NEW format failed, now check if it's the OLD format
            print(f"Failed to parse plan as DetailedTrainingPlan for user {user_id}, race {race_id}. Error: {detailed_exc}")
            try:
                # Attempt to parse as the OLD TrainingPlanOutline
                TrainingPlanOutline.parse_obj(plan_data)
                # If this succeeds, it means the data matches the OLD structure
                print("Plan data matches OLD TrainingPlanOutline format.")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, # Or 422
                    detail="Saved plan uses an outdated format. Please delete it and generate a new one."
                )
            except ValidationError as outline_exc:
                # If it fails validation as BOTH new and old, then the data is truly corrupt/invalid
                print(f"Failed to parse plan as TrainingPlanOutline as well. Error: {outline_exc}")
                raise HTTPException(status_code=500, detail="Saved plan data is invalid or corrupted.")

    except HTTPException as e:
        raise e # Re-raise 404, 409, 500 from above
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

# --- Endpoint to Delete a Saved Training Plan --- 

@router.delete(
    "/races/{race_id}/generated-plan",
    status_code=status.HTTP_204_NO_CONTENT, # Standard for successful DELETE
    summary="Delete a Saved Training Plan",
    responses={
        404: {"detail": "No saved plan found for this race to delete."},
        204: {"description": "Plan successfully deleted."}
    }
)
async def delete_saved_plan(
    race_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Deletes a previously saved generated training plan for the user and specified race."""
    user_id = str(current_user.id)
    print(f"Attempting to delete plan for user {user_id}, race {race_id}")

    try:
        delete_response = supabase.table("user_generated_plans")\
            .delete()\
            .eq("user_id", user_id)\
            .eq("race_id", str(race_id))\
            .execute()

        # Check if any rows were deleted. 
        # Supabase delete might return empty data list even if successful.
        # A more reliable check might involve checking response metadata if available,
        # or simply assuming success if no error is raised and proceeding.
        # Let's assume for now that if no exception occurs, it worked or the record didn't exist.

        # You could potentially do a select first to ensure it exists and return 404,
        # but delete is often idempotent (deleting non-existent is okay).
        
        # Check for explicit errors in the response object if Supabase provides them
        if hasattr(delete_response, 'error') and delete_response.error:
            print(f"Supabase plan deletion error: {delete_response.error}")
            # Don't expose DB error details directly usually
            raise HTTPException(status_code=500, detail="Database error during deletion.")

        # Optional: Check count if available to confirm deletion
        # count = delete_response.count if hasattr(delete_response, 'count') else None
        # print(f"Delete operation count: {count}")
        # if count == 0:
        #     # If count is reliably 0 when nothing matched, return 404
        #     raise HTTPException(status_code=404, detail="No saved plan found for this race to delete.")

        print(f"Successfully deleted plan (or plan did not exist) for user {user_id}, race {race_id}")
        # No need to return anything on 204 No Content
        return

    except HTTPException as http_exc:
        raise http_exc # Re-raise specific exceptions like potential 404
    except Exception as e:
        print(f"Error deleting saved plan for user {user_id}, race {race_id}: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while deleting the plan.") 

# --- Endpoint for AI Workout Analysis --- 

@router.post(
    "/plan/analyze-workout", 
    response_model=WorkoutAnalysisResponse,
    summary="Get AI feedback on a completed workout"
)
async def analyze_completed_workout(
    request: WorkoutAnalysisRequest,
    supabase: Client = Depends(get_supabase_client), # Keep unused for now, might need later
    current_user: SupabaseUser = Depends(get_current_user)
):
    """Provides AI-driven feedback on a single completed workout, considering user notes and plan context."""
    user_id = str(current_user.id)
    workout = request.workout
    context = request.plan_context

    # Basic check: Ensure the workout is actually completed
    if workout.status != 'completed':
        raise HTTPException(status_code=400, detail="Workout must be marked as completed to be analyzed.")

    # --- Build Prompt Step-by-Step --- 
    context_lines = []
    if context:
        context_lines.append(f"Training Plan Context:")
        if context.race_name: context_lines.append(f"- Race: {context.race_name} ({context.race_distance or 'N/A'})")
        if context.goal_time: context_lines.append(f"- Goal Time: {context.goal_time}")
        if context.pr_used:   context_lines.append(f"- Relevant PR: {context.pr_used}")
        if context.week_number and context.plan_total_weeks: 
            context_lines.append(f"- Current Week: {context.week_number} of {context.plan_total_weeks}")
    context_str = "\n".join(context_lines)

    # --- Build Prompt Step-by-Step --- 
    prompt_parts = [
        "Analyze the following completed running workout based on the provided context.",
        "\n",
        context_str,
        "\n",
        "Completed Workout Details:",
        f"- Date: {workout.date} ({workout.day_of_week})",
        f"- Type: {workout.workout_type}",
        f"- Planned Description: {workout.description}",
        f"- Planned Distance: {workout.distance or 'N/A'}",
        f"- Planned Duration: {workout.duration or 'N/A'}",
        f"- Planned Intensity: {workout.intensity or 'N/A'}",
        "\n",
    ]

    # Conditionally add user notes section
    if workout.notes:
        prompt_parts.append("User's Notes on Completion:")
        prompt_parts.append('""' + "\n".join(workout.notes) + '""' ) # Add quotes around notes
    else:
        prompt_parts.append("User did not provide any notes for this workout.")

    # Add Instructions
    prompt_parts.extend([
        "\n",
        "Instructions:",
        "- Analyze the workout completion based on the available information.",
        "- **Your goal is to provide feedback on the user's subjective experience (from their notes, if provided) relative to the *planned* workout's purpose and intensity.**",
        "- **Do NOT expect or ask for quantitative data about the *actual* performance (like exact distance, pace, time, HR). Base your feedback *only* on the provided planned details and the user's notes.**",
        "- **If no user notes were provided, give brief (2-sentence) encouragement related to completing the planned workout.**",
        "- Provide exactly 2-3 sentences of concise, insightful, and encouraging feedback based *only* on the information provided.",
        "- Focus on whether the user's experience aligned with the workout's purpose and if the notes indicate anything positive or concerning for that specific workout.",
        "- Frame the feedback constructively. Avoid generic statements. Tailor it to the specifics.",
        "- **Do NOT ask follow-up questions.**",
        "- **Do NOT suggest next steps or future plan adjustments.**",
        "- **Your entire response MUST be ONLY the 2-3 sentences of feedback text. Nothing before or after.**",
        "\n",
        "Feedback:"
    ])

    prompt = "\n".join(prompt_parts)
    # --------------------------------

    # --- Call AI Model --- 
    if not gemini_api_key:
        raise HTTPException(status_code=503, detail="AI analysis service is not configured.")

    try:
        # Consider using a different model or settings if needed for analysis tasks
        model = genai.GenerativeModel('gemini-1.5-pro') 
        
        # --- Add Generation Config for Brevity --- 
        generation_config = genai.types.GenerationConfig(
            max_output_tokens=200, # Increased token limit
            temperature=0.4      # Lower temperature for less creativity
        )
        # -----------------------------------------
 
        # Log the prompt being sent
        print(f"--- Sending Analysis Prompt to AI ---\n{prompt}\n-------------------------------------")

        response = await model.generate_content_async(
            prompt,
            generation_config=generation_config # Pass the config
        )
        
        # Basic response validation - check for empty or blocked response
        if not response.text:
            print(f"Warning: AI returned empty feedback for user {user_id}, workout date {workout.date}")
            # Consider potential safety flags if available in response object
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
                print(f"Safety Block Reason: {response.prompt_feedback.block_reason}")
                raise HTTPException(status_code=400, detail=f"Analysis request blocked due to safety filters ({response.prompt_feedback.block_reason}). Please revise notes or contact support.")
            raise HTTPException(status_code=500, detail="AI analysis failed to generate feedback.")

        feedback_text = response.text.strip()
        return WorkoutAnalysisResponse(feedback=feedback_text)

    except Exception as e:
        print(f"Error during AI workout analysis for user {user_id}, workout date {workout.date}: {e}")
        # Don't expose internal error details usually
        raise HTTPException(status_code=500, detail="Failed to get analysis from AI service.")

# --- END Endpoint for AI Workout Analysis --- 