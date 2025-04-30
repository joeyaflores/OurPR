from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

class AchievementBase(BaseModel):
    code: str
    name: str
    description: str
    icon_name: str

class Achievement(AchievementBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserAchievementBase(BaseModel):
    user_id: uuid.UUID
    achievement_id: uuid.UUID

class UserAchievement(UserAchievementBase):
    id: uuid.UUID
    earned_at: datetime
    # Optionally include nested achievement details if needed from joins
    achievement: Optional[Achievement] = None 

    class Config:
        from_attributes = True

# Model for the response of the GET /users/me/achievements endpoint
class EarnedAchievementDetail(AchievementBase):
     earned_at: datetime
     achievement_id: uuid.UUID # Include achievement ID for frontend keying if needed
     
     class Config:
        from_attributes = True 