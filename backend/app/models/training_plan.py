from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import date, datetime # Import date and datetime

class WeeklySummary(BaseModel):
    week_number: int = Field(..., description="Week number (e.g., 1, 2, ...)")
    summary: str = Field(..., description="Brief description of the week's focus and key workouts (e.g., 'Focus on base mileage. Long run: 8 miles. Include 1 tempo run.')")
    estimated_weekly_mileage: str | None = Field(None, description="Estimated total mileage for the week (e.g., '20-25 miles')")
    # Optional: Could add fields for total mileage, key workouts list, etc.

class TrainingPlanOutline(BaseModel):
    race_name: str
    race_distance: str
    total_weeks: int
    weeks: List[WeeklySummary] = Field(..., description="List of weekly training summaries leading up to the race")
    notes: List[str] | None = Field(None, description="Optional additional notes or disclaimers from the AI")

# --- Detailed Daily Plan Pydantic Models ---

class DailyWorkout(BaseModel):
    date: str # ISO 8601 Format: "YYYY-MM-DD"
    day_of_week: Literal['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    workout_type: Literal['Easy Run', 'Tempo Run', 'Intervals', 'Speed Work', 'Long Run', 'Rest', 'Cross-Training', 'Strength', 'Race Pace', 'Warm-up', 'Cool-down', 'Other']
    description: str # e.g., "5 miles at conversational pace"
    distance: Optional[str] = None # e.g., "5 miles"
    duration: Optional[str] = None # e.g., "45 minutes"
    intensity: Optional[str] = None # e.g., "Easy", "Tempo"
    notes: Optional[List[str]] = None
    status: Literal['pending', 'completed', 'skipped'] = 'pending' # Default to pending
    google_event_id: Optional[str] = None # ID of the event created in Google Calendar

class DetailedWeek(BaseModel):
    week_number: int
    start_date: str # "YYYY-MM-DD" of the Monday
    end_date: str # "YYYY-MM-DD" of the Sunday
    days: List[DailyWorkout] # Array of 7 DailyWorkout objects
    weekly_focus: Optional[str] = None
    estimated_weekly_mileage: Optional[str] = None

class DetailedTrainingPlan(BaseModel):
    plan_id: str = Field(default_factory=lambda: str(uuid.uuid4())) # Generate UUID for new plans
    user_id: str # Needs to be set when creating/saving
    race_name: str
    race_distance: str
    race_date: str # "YYYY-MM-DD"
    goal_time: Optional[str] = None # <-- ADDED: User's desired finish time (e.g., "1:45:00")
    plan_start_date: str # "YYYY-MM-DD" - First Monday of the plan
    total_weeks: int
    weeks: List[DetailedWeek]
    overall_notes: Optional[List[str]] = None
    personalization_details: Optional[dict] = None # Keep flexible for now
    generated_at: str = Field(default_factory=lambda: datetime.now().isoformat()) # Timestamp
    plan_version: str = "v2.0-daily" # Version indicator

# --- Model for Updating Daily Workout Status --- 

class DailyWorkoutStatusUpdate(BaseModel):
    status: Literal['pending', 'completed', 'skipped'] 

# --- Models for Workout Analysis --- 

class PlanContextForAnalysis(BaseModel):
    """Optional context about the overall plan for the AI."""
    race_name: Optional[str] = None
    race_distance: Optional[str] = None
    goal_time: Optional[str] = None
    plan_total_weeks: Optional[int] = None
    week_number: Optional[int] = None # The week number this workout belongs to
    pr_used: Optional[str] = None

class WorkoutAnalysisRequest(BaseModel):
    """Request body for the workout analysis endpoint."""
    race_id: uuid.UUID # Although redundant with URL, good for validation
    workout: DailyWorkout # The specific workout object, including user notes
    plan_context: Optional[PlanContextForAnalysis] = None

class WorkoutAnalysisResponse(BaseModel):
    """Response body containing the AI feedback."""
    feedback: str 