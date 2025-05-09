import os # <-- Add import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Import CORS Middleware
from dotenv import load_dotenv # <-- Add import load_dotenv

# Import API routers
from .api import races, user_prs, race_query, user_plans # Add user_plans
from .api import user_goal
from .api import recommendations
from .api import training_plans # <-- Import the new router
from .api import achievements # <-- Import the new achievements router
from .api import workouts # <-- Import the new workouts router
from .api import weekly_goals # <-- NEW: Import the weekly goals router
from .api import google_calendar # <-- Import the new Google Calendar router module

load_dotenv() # <-- Load environment variables from .env file

app = FastAPI(
    title="OurPR Backend API",
    description="API for managing races, user PRs, AI-powered search, and user plans.", # Updated description
    version="0.1.0",
)

# CORS Configuration
# Dynamically set origins based on environment variable
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Define allowed origins
# Add your Vercel production URL and potentially preview URLs here
origins = [
    frontend_url, # Dynamically set from FRONTEND_URL
    "https://ourpr.app", # Explicitly allow the production domain
    "https://www.ourpr.app", # Explicitly allow the www production domain
    # Example for Vercel preview URLs (more specific is better)
    # "https://our-pr-joeyflores74s-projects-*.vercel.app",
]

# Add a specific check for Render's PR preview URLs if you use them
render_preview_url = os.getenv("RENDER_EXTERNAL_URL")
if render_preview_url and render_preview_url.endswith(".onrender.com"):
    origins.append(render_preview_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

@app.head("/", tags=["Root"])
async def root():
    return {"message": "Welcome to the OurPR API"}


# Include API routers
app.include_router(races.router, prefix="/api", tags=["Races"])
app.include_router(user_prs.router, prefix="/api", tags=["User PRs"])
app.include_router(race_query.router, prefix="/api/race-query", tags=["Race Query"])
app.include_router(user_plans.router, prefix="/api", tags=["User Plan"]) # Add user_plans router (includes /users/me/plan)
app.include_router(user_goal.router, prefix="/api") # Prefix is already in the router file
app.include_router(recommendations.router, prefix="/api") # Prefix is already in the router file
app.include_router(training_plans.router, prefix="/api") # <-- Add prefix="/api"
app.include_router(achievements.router, prefix="/api") # <-- Add the achievements router
app.include_router(workouts.router, prefix="/api") # <-- Add the workouts router
app.include_router(weekly_goals.router, prefix="/api") # <-- NEW: Include the weekly goals router

# --- Include Google Calendar Routers --- 
# OAuth login/callback endpoints (no user-specific prefix needed)
app.include_router(google_calendar.router, prefix="/api") 
# Calendar sync endpoints (needs user context, mount under /users/me)
app.include_router(google_calendar.calendar_router, prefix="/api/users/me")
# --- End Google Calendar Routers --- 

# Add other routers here later (e.g., auth) 