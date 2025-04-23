import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    raise ValueError("Supabase URL and Key must be set in the environment variables.")

supabase: Client = create_client(url, key)

def get_supabase_client() -> Client:
    """Returns the initialized Supabase client."""
    return supabase 