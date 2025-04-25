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
    is_official: bool = True # Added field
    race_name: Optional[str] = None # Added field

class UserPrUpdate(BaseModel):
    # Allow updating date, time, or associated race
    # Accept date as string initially for flexibility during parsing
    date: Optional[str] = None
    time_in_seconds: Optional[int] = None
    race_id: Optional[uuid.UUID] = None
    is_official: Optional[bool] = None # Added field
    race_name: Optional[str] = None # Added field

class UserPr(UserPrBase):
    id: uuid.UUID
    created_at: datetime
    is_official: Optional[bool] = True  # Make optional for response handling
    race_name: Optional[str] = None # Added optional field

    class Config:
        from_attributes = True # Use Pydantic v2 standard 