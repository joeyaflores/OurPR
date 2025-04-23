from fastapi import FastAPI

# Import API routers
from .api import races, user_prs, race_query

app = FastAPI(
    title="OurPR Backend API",
    description="API for managing races, user PRs, and AI-powered search.",
    version="0.1.0",
)


@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to the OurPR API"}


# Include API routers
app.include_router(races.router, prefix="/api", tags=["Races"])
app.include_router(user_prs.router, prefix="/api", tags=["User PRs"])
app.include_router(race_query.router, prefix="/api/race-query", tags=["Race Query"])

# Add other routers here later (e.g., auth) 