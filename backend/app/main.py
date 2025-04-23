from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Import CORS Middleware

# Import API routers
from .api import races, user_prs, race_query, user_plans # Add user_plans

app = FastAPI(
    title="OurPR Backend API",
    description="API for managing races, user PRs, AI-powered search, and user plans.", # Updated description
    version="0.1.0",
)

# CORS Configuration
# TODO: Restrict origins for production
origins = [
    "http://localhost:3000", # Next.js frontend development server
    "http://localhost:3001", # Allow potentially different frontend dev port
    # Add any other origins if needed (e.g., deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to the OurPR API"}


# Include API routers
app.include_router(races.router, prefix="/api", tags=["Races"])
app.include_router(user_prs.router, prefix="/api", tags=["User PRs"])
app.include_router(race_query.router, prefix="/api/race-query", tags=["Race Query"])
app.include_router(user_plans.router, prefix="/api", tags=["User Plan"]) # Add user_plans router (includes /users/me/plan)

# Add other routers here later (e.g., auth) 