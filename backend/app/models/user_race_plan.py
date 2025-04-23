from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

# Model for the request body when adding a race to a plan
class UserRacePlanCreate(BaseModel):
    race_id: uuid.UUID

# Model representing a record in the user_race_plans table
class UserRacePlan(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    race_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True # For Pydantic V2 