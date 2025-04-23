from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from supabase import Client, AuthApiError
from gotrue.types import User as SupabaseUser

from ..services.supabase_client import get_supabase_client

# Although we use Bearer tokens, OAuth2PasswordBearer helps extract the token
# It expects the token to be passed in the Authorization header as "Bearer <token>"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(request: Request, supabase: Client = Depends(get_supabase_client)) -> SupabaseUser:
    """Dependency function to get the current user from Supabase JWT.

    Reads the Authorization header, validates the JWT using Supabase,
    and returns the user object or raises HTTPException.
    """
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not token.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format. Use 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jwt = token.split(" ", 1)[1]

    try:
        # Validate the token and get user info from Supabase
        res = supabase.auth.get_user(jwt)
        user = res.user
        if not user:
            # This case might occur if the token is valid but the user doesn't exist anymore
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials or user not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # You can return the full user object or specific parts like user.id
        return user
    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        # Catch unexpected errors during validation
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during authentication: {e}",
        )

# Example of how to protect an endpoint (add this to your route definitions):
# from fastapi import APIRouter
# from .auth import get_current_user
# from supabase.lib.auth_client import UserResponse
# from gotrue.types import User
#
# router = APIRouter()
#
# @router.get("/users/me")
# async def read_users_me(current_user: SupabaseUser = Depends(get_current_user)):
#     return current_user 