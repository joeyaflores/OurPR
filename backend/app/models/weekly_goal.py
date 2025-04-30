# backend/app/models/weekly_goal.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date, datetime
import uuid

class WeeklyGoalBase(BaseModel):
    """Base model for weekly goals, defining common fields."""
    week_start_date: date = Field(..., description="The Monday of the week this goal applies to.")
    target_distance_meters: Optional[float] = Field(None, gt=0, description="Target total distance in meters for the week.")
    target_duration_seconds: Optional[int] = Field(None, gt=0, description="Target total duration in seconds for the week.")
    target_workouts: Optional[int] = Field(None, gt=0, description="Target number of workout sessions for the week.")

    @field_validator('target_distance_meters', 'target_duration_seconds', 'target_workouts', mode='after')
    @classmethod
    def check_at_least_one_target(cls, v, info):
        # Get all field values
        values = info.data
        
        # Create a copy of values and update with current field's value
        updated_values = values.copy()
        updated_values[info.field_name] = v
        
        # Check if at least one target is set and greater than 0
        has_distance = updated_values.get('target_distance_meters') is not None and updated_values['target_distance_meters'] > 0
        has_duration = updated_values.get('target_duration_seconds') is not None and updated_values['target_duration_seconds'] > 0
        has_workouts = updated_values.get('target_workouts') is not None and updated_values['target_workouts'] > 0
        
        if not has_distance and not has_duration and not has_workouts:
            raise ValueError('At least one target (distance, duration, or workouts) must be set and be greater than 0.')
        
        return v

    class Config:
        from_attributes = True

class WeeklyGoalCreate(WeeklyGoalBase):
    """Model for creating a new weekly goal. user_id is added by API."""
    pass # Inherits fields and validation from Base

class WeeklyGoalUpdate(BaseModel):
    """
    Model for updating an existing weekly goal.
    All fields are optional, allowing partial updates.
    week_start_date is typically fixed once created, but allowing update might be useful.
    """
    week_start_date: Optional[date] = None # Usually not updated, but possible
    target_distance_meters: Optional[float] = Field(None, gt=0)
    target_duration_seconds: Optional[int] = Field(None, gt=0)
    target_workouts: Optional[int] = Field(None, gt=0)

    # Add a validator to ensure at least one field is being updated? Optional.

class WeeklyGoal(WeeklyGoalBase):
    """Model representing a weekly goal as retrieved from the database."""
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime 