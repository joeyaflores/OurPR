import os
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status, Header
from typing import Annotated, Optional
from postgrest import SyncPostgrestClient

load_dotenv()  # Load environment variables from .env file

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    raise ValueError("Supabase URL and Key must be set in the environment variables.")

# Base client initialized with URL and anon/service key
supabase_base_client: Client = create_client(url, key)

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

# Optional: Keep a way to get the base client if needed elsewhere (e.g., for admin tasks)
def get_base_supabase_client() -> Client:
    """Dependency that returns the base Supabase client (initialized with URL and key)."""
    return supabase_base_client 