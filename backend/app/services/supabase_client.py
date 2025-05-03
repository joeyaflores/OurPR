import os
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status, Header
from typing import Annotated, Optional
from postgrest import SyncPostgrestClient

load_dotenv()  # Load environment variables from .env file

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
# --- Add Service Role Key --- 
service_role_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise ValueError("Supabase URL and Key must be set in the environment variables.")
# --- Check Service Role Key --- 
if not service_role_key:
    # Decide how critical this is. For the callback, it IS critical.
    print("Warning: SUPABASE_SERVICE_ROLE_KEY is not set. Operations requiring service role will fail.")
    # raise ValueError("Supabase Service Role Key must be set for service operations.")


# Base client initialized with URL and anon/service key
supabase_base_client: Client = create_client(url, key)

# --- Create a separate client instance for service role --- 
# Avoid modifying the base client directly if it's used elsewhere with anon key
supabase_service_client: Optional[Client] = None
if service_role_key:
    try:
        # Create a new client instance specifically for service role
        supabase_service_client = create_client(url, service_role_key)
    except Exception as e:
        print(f"Error creating Supabase service client: {e}")
        # Handle error appropriately, maybe raise or log
else:
    # Handle case where service key is missing but code proceeds
    pass

def get_supabase_client(
    authorization: Annotated[Optional[str], Header()] = None
) -> SyncPostgrestClient:
    """Dependency that provides a Supabase Postgrest client configured with user auth."""
    if not authorization or not authorization.startswith("Bearer "):
        # Or handle based on whether endpoint strictly requires auth
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
        
    token = authorization.split(" ")[1]
    
    try:
        # Use the .auth() method which should return a configured instance
        # Note: We are returning the PostgrestClient specifically, as that's what .auth() configures
        authed_postgrest_client = supabase_base_client.postgrest.auth(token)
        print(f"DEBUG [get_supabase_client]: Created authed_postgrest_client of type {type(authed_postgrest_client)}")
        return authed_postgrest_client
    except Exception as e:
        # Catch potential errors during .auth() if any
        print(f"ERROR [get_supabase_client]: Failed to get authenticated client: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not initialize authenticated database client.")

# --- New Dependency for Service Client --- 
def get_supabase_service_client() -> Client:
    """Dependency that provides a Supabase client configured with the Service Role Key."""
    if not supabase_service_client:
        # This happens if the service_role_key was missing or client creation failed
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="Database service client is not available. Check server configuration."
        )
    return supabase_service_client
# --- End New Dependency ---

# Optional: Keep a way to get the base client if needed elsewhere (e.g., for admin tasks)
def get_base_supabase_client() -> Client:
    """Dependency that returns the base Supabase client (initialized with URL and key)."""
    return supabase_base_client 