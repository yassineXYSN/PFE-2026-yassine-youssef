import sys
import os
# Ensure the backend directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database.mongodb import connect_mongodb
from database.supabase import connect_supabase
from routers import (
    profiles, companies, departments, jobs, stats, 
    candidates, ai_matching, applications, saved_jobs,
    interviews, external_auth, notifications
)
import auth
from utils.schedulers import start_reminder_scheduler
from routers.quiz import router as quiz_router, test_router as quiz_test_router
from routes.candidat.account_setup import router as candidat_account_setup_router
from routes.candidat.profile import router as candidat_profile_router
from routes.candidat.settings import router as candidat_settings_router
from routes.candidat.twofa import router as candidat_twofa_router
from routes.candidat.jobs import router as candidat_jobs_router
from fastapi.staticfiles import StaticFiles
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    print("--- Starting up: Checking Database Connections ---")
    connect_mongodb()
    connect_supabase()

    # Start background scheduler for interview reminders (every 1 min)
    scheduler_task = asyncio.create_task(start_reminder_scheduler(interval_seconds=60))
    print("--- Interview reminder scheduler started ---")

    yield

    # Cleanup on shutdown
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    print("--- Interview reminder scheduler stopped ---")


app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, prefix="/auth")
app.include_router(auth.router, prefix="/api/auth")

# MongoDB Data Routers
app.include_router(profiles.router, prefix="/api")
app.include_router(companies.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(saved_jobs.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(candidates.router, prefix="/api")
app.include_router(ai_matching.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(external_auth.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(quiz_router, prefix="/api")
app.include_router(quiz_test_router, prefix="/test")
# Ensure static directory exists
os.makedirs(os.path.join(os.path.dirname(__file__), "static"), exist_ok=True)
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

# Include candidat routes under /api/candidat
app.include_router(candidat_account_setup_router, prefix="/api/candidat")
app.include_router(candidat_profile_router, prefix="/api/candidat")
app.include_router(candidat_settings_router, prefix="/api/candidat")
app.include_router(candidat_twofa_router, prefix="/api/candidat")
app.include_router(candidat_jobs_router, prefix="/api")


@app.get("/")
def read_root():
    return {"Hello": "World"}
