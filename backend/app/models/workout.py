from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
from datetime import date, datetime
import uuid

# Define allowed activity types
ActivityType = Literal['run', 'bike', 'swim', 'walk', 'other']

class WorkoutBase(BaseModel):
    date: date
    distance_meters: Optional[float] = Field(None, gt=0, description="Distance in meters")
    duration_seconds: Optional[int] = Field(None, gt=0, description="Duration in seconds")
    activity_type: ActivityType = 'run'
    notes: Optional[str] = None
    effort_level: Optional[int] = Field(None, ge=1, le=5, description="Perceived effort (1-5)")

    @validator('notes')
    def notes_cannot_be_empty_string(cls, v):
        if v == "":
            return None
        return v

    @validator('duration_seconds', always=True)
    def check_distance_or_duration(cls, v, values):
        if values.get('distance_meters') is None and v is None:
            raise ValueError('Either distance_meters or duration_seconds must be provided')
        has_distance = values.get('distance_meters') is not None and values['distance_meters'] > 0
        has_duration = v is not None and v > 0
        if not has_distance and not has_duration:
             raise ValueError('Either distance_meters or duration_seconds must be greater than 0')
        return v

class WorkoutCreate(WorkoutBase):
    # user_id should NOT be defined here. It's added by the API endpoint.
    # user_id: uuid.UUID # Set by the API based on authenticated user <-- REMOVED
    pass # Inherits all fields from WorkoutBase

class WorkoutUpdate(BaseModel):
    # Only allow updating specific fields
    date: Optional[date] = None
    distance_meters: Optional[float] = Field(None, gt=0)
    duration_seconds: Optional[int] = Field(None, gt=0)
    activity_type: Optional[ActivityType] = None
    notes: Optional[str] = None # Allow setting notes to empty string or null
    effort_level: Optional[int] = Field(None, ge=1, le=5)


class Workout(WorkoutBase):
    id: uuid.UUID
    user_id: uuid.UUID # user_id belongs here (in the response/DB model)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 