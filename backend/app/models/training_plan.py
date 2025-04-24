from pydantic import BaseModel, Field
from typing import List

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