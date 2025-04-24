from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ValidationError
from supabase import Client
from typing import List, Optional, Dict, Any
import os
import json
import google.generativeai as genai

from ..services.supabase_client import get_supabase_client
from ..models.race import Race # Import the Race model

# --- Gemini API Configuration ---
try:
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_api_key:
        print("Warning: GEMINI_API_KEY not found in environment variables. AI query parsing will fail.")
        # Allow app to start but fail gracefully if key is missing
    else:
        genai.configure(api_key=gemini_api_key)
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    gemini_api_key = None # Ensure it's None if configuration fails


router = APIRouter()

class QueryRequest(BaseModel):
    query: str

class ParsedFilters(BaseModel):
    # Define fields based on expected output from LLM
    # Ensure these fields match the JSON structure requested in the prompt
    city: Optional[str] = None
    state: Optional[str] = None
    distance: Optional[str] = None # e.g., "5K", "10K", "Half Marathon", "Marathon"
    date_range: Optional[Dict[str, str]] = None # e.g., {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
    flatness: Optional[str] = None # e.g., "flat", "any", "hilly"
    keywords: Optional[List[str]] = None


# --- Gemini Interaction --- 
async def parse_query_with_llm(query: str) -> ParsedFilters:
    """Parses natural language query into structured filters using the Gemini API."""
    if not gemini_api_key:
        print("Error: Gemini API key not configured. Cannot parse query.")
        # Return empty filters or raise an exception depending on desired behavior
        # raise HTTPException(status_code=500, detail="AI service not configured")
        return ParsedFilters() # Fail gracefully for now

    # Choose a Gemini model
    # model = genai.GenerativeModel('gemini-pro') # Standard model
    model = genai.GenerativeModel('gemini-1.5-flash') # Faster model

    # Define the prompt for Gemini
    # Instruct it to extract specific fields and return JSON
    prompt = f"""
    Parse the following user query about finding running races and extract relevant filters.
    Return the filters as a JSON object with the following keys (use null if not mentioned):
    - "city": string (e.g., "Austin")
    - "state": string (e.g., "TX")
    - "distance": string (one of "5K", "10K", "Half Marathon", "Marathon", "Other", or null)
    - "date_range": object with "start" and "end" keys (YYYY-MM-DD format), or null if no specific range.
    - "flatness": string (one of "flat", "hilly", or null if not specified or irrelevant).
    - "keywords": list of strings (other relevant terms mentioned), or null.

    User Query: "{query}"

    JSON Output:
    """

    print(f"Sending query to Gemini: '{query}'")
    try:
        response = await model.generate_content_async(prompt)
        
        # Debug: Print raw response text
        print(f"Gemini raw response: {response.text}")

        # Extract the JSON part (assuming it's directly in response.text)
        # Basic cleanup in case the model adds markdown backticks
        json_text = response.text.strip().strip('```json').strip('```').strip()
        
        # Parse the JSON string into a Python dict
        parsed_json = json.loads(json_text)
        
        # Validate the dict against the Pydantic model
        filters = ParsedFilters.parse_obj(parsed_json)
        print(f"Parsed filters from Gemini: {filters.dict()}")
        return filters

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from Gemini: {e}")
        print(f"Faulty JSON text: {json_text}")
        # Return empty filters if parsing fails
        return ParsedFilters()
    except ValidationError as e:
        print(f"Error validating parsed filters against Pydantic model: {e}")
        print(f"Parsed JSON: {parsed_json}")
        # Return empty filters if validation fails
        return ParsedFilters()
    except Exception as e:
        # Catch other potential errors from the Gemini API call
        print(f"Error calling Gemini API: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing query with AI service: {e}")


async def query_supabase_with_filters(filters: ParsedFilters, supabase: Client) -> List[Race]:
    """Queries the Supabase 'races' table using the parsed filters."""
    try:
        query = supabase.table("races").select("*", count='exact') # Add count='exact' for potential debugging

        # Apply filters dynamically based on ParsedFilters
        if filters.city:
            # Use ilike for case-insensitive partial matching
            query = query.ilike("city", f"%{filters.city}%") 
        if filters.state:
             # Exact match for state might be better depending on data
             query = query.eq("state", filters.state)
        if filters.distance:
            query = query.eq("distance", filters.distance)

        # Apply flatness filter using the new 'total_elevation_gain' column
        FLAT_THRESHOLD = 500  # Example: meters or feet - adjust as needed
        HILLY_THRESHOLD = 800 # Example: meters or feet - adjust as needed
        if filters.flatness == "flat":
            print(f"Applying flatness filter: total_elevation_gain <= {FLAT_THRESHOLD}")
            query = query.lte("total_elevation_gain", FLAT_THRESHOLD)
        elif filters.flatness == "hilly":
            print(f"Applying flatness filter: total_elevation_gain >= {HILLY_THRESHOLD}")
            query = query.gte("total_elevation_gain", HILLY_THRESHOLD)
        # If flatness is null or 'any', no filter is applied

        if filters.date_range:
            if filters.date_range.get("start"):
                query = query.gte("date", filters.date_range["start"])
            if filters.date_range.get("end"):
                query = query.lte("date", filters.date_range["end"])
        
        # TODO: Consider how to use keywords if provided by LLM 
        # Example: Use keywords for full-text search if your DB supports it, or add OR clauses for name/description
        # if filters.keywords:
        #     # This requires FTS setup or complex OR conditions
        #     pass 

        # Example sorting (can be refined)
        query = query.order("date", desc=False).limit(50) # Limit results for AI queries

        response = query.execute()

        # Debugging the count
        print(f"Supabase query count: {response.count}")

        if not hasattr(response, 'data') or not isinstance(response.data, list):
            print(f"Unexpected response from Supabase AI query: {response}")
            raise HTTPException(status_code=500, detail="Unexpected response format from database")

        # TODO: Potentially add further LLM processing here to generate aiSummary or prPotentialScore
        # for each result before returning.

        return response.data

    except Exception as e:
        print(f"Error querying Supabase with filters: {e}")
        raise HTTPException(status_code=500, detail=f"Error querying database with parsed filters: {e}")


@router.post("/ai", response_model=List[Race], tags=["Race Query"])
async def ai_search_races(
    request: QueryRequest,
    supabase: Client = Depends(get_supabase_client)
):
    """Receives a natural language query, parses it using the Gemini API,
    queries the database, and returns matching races.
    """
    print(f"Received AI query: {request.query}")
    # 1. Parse the query using LLM
    filters = await parse_query_with_llm(request.query)

    # 2. Query Supabase DB using generated filters
    results = await query_supabase_with_filters(filters, supabase)

    # 3. Return race results
    # Pydantic validation happens automatically via response_model
    return results 