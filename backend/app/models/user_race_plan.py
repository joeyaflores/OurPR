from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid
from .race import Race # Import the base Race model

# Model for the request body when adding a race to a plan
class UserRacePlanCreate(BaseModel):
    race_id: uuid.UUID

# Model representing a record in the user_race_plans table
class UserRacePlan(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    race_id: uuid.UUID
    created_at: datetime # Use created_at to match DB column

# New response model for GET /users/me/plan/
class PlannedRaceDetail(Race): # Inherit fields from Race
    # Add fields specific to the relationship or needed context
    user_race_plan_id: uuid.UUID # ID of the entry in user_race_plans
    has_generated_plan: bool = Field(False, description="Indicates if a generated plan exists for this user and race")

    class Config:
        from_attributes = True # For Pydantic V2 