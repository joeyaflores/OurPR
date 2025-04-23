from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
import uuid

class UserPrBase(BaseModel):
    user_id: uuid.UUID
    distance: str
    date: date
    time_in_seconds: int
    race_id: Optional[uuid.UUID] = None # Optional link to the race where PR was set

class UserPrCreate(UserPrBase):
    pass

class UserPrUpdate(BaseModel):
    # Allow updating date, time, or associated race
    date: Optional[date] = None
    time_in_seconds: Optional[int] = None
    race_id: Optional[uuid.UUID] = None

class UserPr(UserPrBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True # Use Pydantic v2 standard 