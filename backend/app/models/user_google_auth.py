from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class UserGoogleAuthBase(BaseModel):
    user_id: uuid.UUID = Field(..., description="Foreign key to the auth.users table (UUID)")
    encrypted_google_refresh_token: str = Field(..., description="Fernet encrypted Google Refresh Token")
    google_email: Optional[str] = Field(None, description="User's Google account email (optional)")

class UserGoogleAuthCreate(UserGoogleAuthBase):
    # Typically created/updated via upsert in the callback
    pass

class UserGoogleAuthUpdate(BaseModel):
    # Only allow updating the token or email
    encrypted_google_refresh_token: Optional[str] = None
    google_email: Optional[str] = None

class UserGoogleAuth(UserGoogleAuthBase):
    # Represents the full record including DB timestamps
    updated_at: datetime

    class Config:
        from_attributes = True # Pydantic v2 