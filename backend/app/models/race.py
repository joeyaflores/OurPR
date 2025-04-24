from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional, Literal
from datetime import date, datetime
import uuid

class RaceBase(BaseModel):
    name: str
    city: Optional[str] = None
    state: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    distance: Optional[Literal['5K', '10K', 'Half Marathon', 'Marathon', '50K', '50 Miles', '100K', '100 Miles', 'Other']] = None
    date: Optional[str] = None
    total_elevation_gain: Optional[int] = None
    flatness_score: Optional[int] = None  # e.g., 1-5 (1=very hilly, 5=very flat)
    pr_potential_score: Optional[float] = None
    ai_summary: Optional[str] = None
    website: Optional[str] = None
    similar_runners_count: Optional[int] = None
    training_groups_count: Optional[int] = None
    similar_pace_runners_count: Optional[int] = None
    view_count: int = 0
    save_count: int = 0
    plan_count: int = 0

class RaceCreate(RaceBase):
    # Fields required on creation, if different from base
    pass

class RaceUpdate(BaseModel):
    # Optional fields for updates
    name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    distance: Optional[Literal['5K', '10K', 'Half Marathon', 'Marathon', '50K', '50 Miles', '100K', '100 Miles', 'Other']] = None
    date: Optional[str] = None
    flatness_score: Optional[int] = None
    pr_potential_score: Optional[float] = None
    ai_summary: Optional[str] = None
    website: Optional[str] = None
    view_count: Optional[int] = None
    save_count: Optional[int] = None
    plan_count: Optional[int] = None

class Race(RaceBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True # Use Pydantic v2 standard 