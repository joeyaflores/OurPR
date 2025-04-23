from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from typing import List, Optional, Literal
from datetime import date

from ..services.supabase_client import get_supabase_client
from ..models.race import Race # Import the Race model

router = APIRouter()

@router.get("/races", response_model=List[Race])
async def get_races(
    *, # Makes all subsequent parameters keyword-only
    supabase: Client = Depends(get_supabase_client),
    city: Optional[str] = Query(None, description="Filter by city"),
    state: Optional[str] = Query(None, description="Filter by state"),
    distance: Optional[Literal['5K', '10K', 'Half Marathon', 'Marathon', '50K', '50 Miles', '100K', '100 Miles', 'Other']] = Query(None, description="Filter by distance"),
    flat_only: Optional[bool] = Query(None, description="Filter for mostly flat races (flatness_score >= 4)"),
    start_date: Optional[date] = Query(None, description="Filter races on or after this date"),
    end_date: Optional[date] = Query(None, description="Filter races on or before this date"),
    # TODO: Implement trending/popular logic based on view/save/plan counts or other metrics
    # trending: Optional[bool] = Query(None, description="Order by trending races"),
    # popular: Optional[bool] = Query(None, description="Order by popular races"),
    skip: int = 0,
    limit: int = 100 # Default limit to 100 races
):
    """Retrieve a list of races with filtering and pagination."""
    try:
        query = supabase.table("races").select("*")

        # Apply filters dynamically
        if city:
            query = query.eq("city", city)
        if state:
            query = query.eq("state", state)
        if distance:
            query = query.eq("distance", distance)
        if flat_only:
            # Assuming flatness_score 4 and 5 mean flat
            query = query.gte("flatness_score", 4)
        if start_date:
            query = query.gte("date", str(start_date))
        if end_date:
            query = query.lte("date", str(end_date))

        # Apply sorting (Example: by date ascending)
        # Add logic for trending/popular sorting here if needed
        query = query.order("date", desc=False)

        # Apply pagination
        query = query.offset(skip).limit(limit)

        response = query.execute()

        # Check if data is present and is a list
        if not hasattr(response, 'data') or not isinstance(response.data, list):
            # Log the actual response for debugging if necessary
            print(f"Unexpected response from Supabase: {response}")
            raise HTTPException(status_code=500, detail="Unexpected response format from database")

        # Pydantic will automatically validate the list of dicts against List[Race]
        return response.data

    except HTTPException as e:
        # Re-raise HTTPExceptions directly
        raise e
    except Exception as e:
        # Handle potential errors during Supabase query
        # Log the error e for debugging
        print(f"Error querying races: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching races: {e}") 