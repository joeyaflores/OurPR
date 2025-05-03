import os
from datetime import date
from typing import Optional, Tuple, Dict, Any

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build, Resource
from googleapiclient.errors import HttpError
from cryptography.fernet import Fernet

# --- Configuration (Load from Environment Variables) ---

# It's crucial these are set in your environment (e.g., .env file)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
# Ensure this matches the URI registered in Google Cloud Console
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback") 
# Generate a strong key using Fernet.generate_key() and store it securely
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY") 

# The scopes needed for calendar event management
SCOPES = ['https://www.googleapis.com/auth/calendar.events']

# --- Input Validation ---
if not all([GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ENCRYPTION_KEY]):
    print("Warning: Missing Google OAuth credentials or Encryption Key in environment variables. Google Calendar Service may fail.")
    # Optionally raise an error or handle this more gracefully depending on requirements
    # raise EnvironmentError("Missing required Google Calendar service configuration.")

try:
    # Initialize Fernet with the encryption key
    fernet = Fernet(ENCRYPTION_KEY.encode() if ENCRYPTION_KEY else b'') 
except (ValueError, TypeError) as e:
     print(f"Warning: Invalid ENCRYPTION_KEY format. Encryption/Decryption will fail. Error: {e}")
     fernet = None # Ensure fernet is None if key is bad

# --- Encryption/Decryption Helpers ---

def encrypt_token(token: str) -> Optional[str]:
    """Encrypts a token using Fernet."""
    if not fernet:
        print("Error: Encryption service not available due to invalid key.")
        return None
    try:
        return fernet.encrypt(token.encode()).decode()
    except Exception as e:
        print(f"Error encrypting token: {e}")
        return None

def decrypt_token(encrypted_token: str) -> Optional[str]:
    """Decrypts a token using Fernet."""
    if not fernet:
        print("Error: Decryption service not available due to invalid key.")
        return None
    try:
        return fernet.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        # Handles incorrect padding, invalid token, etc.
        print(f"Error decrypting token: {e}")
        return None

# --- Google API Interaction ---

def get_google_auth_flow() -> Optional[Flow]:
    """Initializes and returns the Google OAuth Flow object."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        print("Error: Cannot create OAuth flow, missing client ID or secret.")
        return None
    try:
        flow = Flow.from_client_config(
            client_config={
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GOOGLE_REDIRECT_URI], # Must match console setup
                    "javascript_origins": [] # Add frontend origins if needed (e.g., ["http://localhost:3000"])
                }
            },
            scopes=SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI
        )
        return flow
    except Exception as e:
        print(f"Error initializing Google OAuth Flow: {e}")
        return None

async def exchange_code_for_tokens(code: str) -> Optional[Tuple[str, str, Optional[str]]]:
    """Exchanges an authorization code for access and refresh tokens."""
    flow = get_google_auth_flow()
    if not flow:
        return None
    try:
        # Use async fetch_token if running in async context (FastAPI)
        # Note: Requires httpx installed, which comes with google-auth-httplib2[async]
        # await flow.async_fetch_token(code=code) 
        
        # --- Use standard synchronous fetch_token --- 
        flow.fetch_token(code=code)
        # -------------------------------------------

        credentials = flow.credentials
        
        # Encrypt the refresh token before returning
        encrypted_refresh_token = None
        if credentials.refresh_token:
            encrypted_refresh_token = encrypt_token(credentials.refresh_token)
            if not encrypted_refresh_token:
                print("Warning: Failed to encrypt refresh token.")
                # Decide if this is critical. Maybe return None or raise specific error?
        
        # Extract user email if needed (requires 'openid', 'email', 'profile' scopes typically)
        user_email = None 
        # To get email, you'd typically need to request additional scopes and use the access token
        # to call the Google UserInfo endpoint. For simplicity, omitting this now.

        return credentials.token, encrypted_refresh_token, user_email
    except Exception as e:
        print(f"Error exchanging authorization code for tokens: {e}")
        return None

def get_credentials_from_refresh_token(encrypted_refresh_token: str) -> Optional[Credentials]:
    """Creates Google API Credentials using a stored (decrypted) refresh token."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        print("Error: Cannot get credentials, missing client ID or secret.")
        return None
        
    refresh_token = decrypt_token(encrypted_refresh_token)
    if not refresh_token:
        print("Error: Failed to decrypt refresh token.")
        return None

    try:
        credentials = Credentials(
            token=None, # Access token will be fetched automatically on first API call
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=SCOPES
        )
        # Optional: Check if credentials are valid (might trigger a refresh)
        # if not credentials.valid:
        #     credentials.refresh(Request()) # Requires google.auth.transport.requests.Request()
        
        return credentials
    except Exception as e:
        print(f"Error creating credentials from refresh token: {e}")
        return None

async def get_calendar_service(credentials: Credentials) -> Optional[Resource]:
    """Builds and returns the Google Calendar API service resource."""
    if not credentials:
        return None
    try:
        # Use build_async if available and running in async context
        service = build('calendar', 'v3', credentials=credentials)
        return service
    except Exception as e:
        print(f"Error building Google Calendar service: {e}")
        return None

async def create_calendar_event(
    service: Resource, 
    summary: str, # This will now be the workout_type
    description: str, 
    event_date: date, # Use Python date object
    race_name: str, # <-- Add race_name parameter
    calendar_id: str = 'primary'
) -> Optional[Dict[str, Any]]:
    """Creates an all-day event in the specified Google Calendar."""
    if not service:
        return None
    
    # Format date for all-day event (YYYY-MM-DD)
    date_str = event_date.isoformat()
    
    # Google Calendar Event resource structure for an all-day event
    event_resource = {
        # --- Update Summary Prefix --- 
        'summary': f"OurPR: {race_name} - {summary.replace('[Training Plan] ', '')}", # New: Includes race name
        # ---------------------------
        'description': description,
        'start': {
            'date': date_str,
            # 'timeZone': 'UTC', # Specify timezone if needed, otherwise uses calendar's default
        },
        'end': {
            'date': date_str, # For all-day events, end date is exclusive, but API handles single date correctly
            # 'timeZone': 'UTC', 
        },
        # --- Add Specific Reminder --- 
        'reminders': {
            'useDefault': False, # Override the user's default reminders for this event
            'overrides': [
                # Reminder 16 hours before midnight = 8:00 AM the day before
                {'method': 'popup', 'minutes': 16 * 60}, 
            ],
        },
        # ---------------------------
        # Optional: Add color, etc.
    }

    try:
        # Execute the insert request synchronously
        created_event = service.events().insert(
            calendarId=calendar_id, 
            body=event_resource
        ).execute()
        print(f"Event created: {created_event.get('htmlLink')}")
        return created_event
    except HttpError as error:
        print(f"An API error occurred creating event: {error}")
        # Consider specific error handling (e.g., 403 Forbidden, 404 Not Found)
        return None
    except Exception as e:
        print(f"An unexpected error occurred creating event: {e}")
        return None

async def delete_calendar_event(
    service: Resource, 
    event_id: str, 
    calendar_id: str = 'primary'
) -> bool:
    """Deletes an event from the specified Google Calendar."""
    if not service or not event_id:
        return False
    try:
        # Execute the delete request synchronously
        service.events().delete(
            calendarId=calendar_id, 
            eventId=event_id
        ).execute()
        print(f"Event deleted: {event_id}")
        return True
    except HttpError as error:
        # Handle cases where the event might already be deleted (404 or 410 Gone)
        if error.resp.status in [404, 410]:
            print(f"Event {event_id} not found or already deleted. Assuming success.")
            return True 
        print(f"An API error occurred deleting event {event_id}: {error}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred deleting event {event_id}: {e}")
        return False 