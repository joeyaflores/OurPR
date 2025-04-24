from pydantic import BaseModel, Field
from pydantic_core import core_schema
from typing import Optional
from datetime import date, timedelta, datetime
import uuid

class UserGoalBase(BaseModel):
    goal_race_name: Optional[str] = Field(None, description="Name of the goal race, e.g., 'CIM 2025'")
    goal_race_date: Optional[date] = Field(None, description="Date of the goal race")
    goal_distance: Optional[str] = Field(None, description="Target distance, e.g., 'Marathon'")
    goal_time: Optional[timedelta] = Field(None, description="Target time for the distance, e.g., 03:15:00")

    class Config:
        from_attributes = True


class UserGoalCreate(UserGoalBase):
    # user_id will be derived from the authenticated token, not passed in body
    pass

class UserGoalUpdate(UserGoalBase):
    # Allow updating any field
    pass

class UserGoal(UserGoalBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime 