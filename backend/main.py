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
    interviews, external_auth, notifications, parametrage, team
)
from routers.superadmin_settings import router as superadmin_settings_router
from routers.ai_analysis import router as ai_analysis_router
from services.job_market_ai_service import is_engine_available, get_engine_status
from services.transcription import get_whisper_service
import auth
import httpx
import os
from utils.schedulers import start_reminder_scheduler, start_job_deadline_scheduler, start_weekly_report_scheduler
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

    # Start background scheduler for job deadlines (every 1 min)
    job_deadline_task = asyncio.create_task(start_job_deadline_scheduler(interval_seconds=60))
    print("--- Job deadline scheduler started ---")

    # Start background scheduler for weekly reports (every 1 hour)
    weekly_report_task = asyncio.create_task(start_weekly_report_scheduler(interval_seconds=3600))
    print("--- Weekly report scheduler started ---")

    # --- AI Models Status Check ---
    print("\n--- Checking AI Infrastructure Status ---")
    
    # 1. Local CNN Model Status
    cnn_status = get_engine_status()
    cnn_label = "[Local CNN Model]"
    if cnn_status["status"] == "ready":
        print(f"{cnn_label} READY (Device: {cnn_status.get('device', 'cpu')})")
    elif cnn_status["status"] == "error":
        print(f"{cnn_label} ERROR: {cnn_status.get('detail')}")
    else:
        print(f"{cnn_label} NOT LOADED (Lazy loading enabled)")

    # 2. Embedding Model / Ollama Status
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/api")
    embedding_model = os.getenv("PROFILE_ANALYSIS_EMBEDDING_MODEL", "nomic-embed-text")
    ollama_label = f"[Embedding Server (Ollama)]"
    
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{ollama_url}/tags")
            if resp.status_code == 200:
                tags = resp.json().get("models", [])
                model_names = [t.get("name") for t in tags]
                if any(embedding_model in m for m in model_names):
                    print(f"{ollama_label} READY (Model '{embedding_model}' found)")
                else:
                    print(f"{ollama_label} WARNING: Server up, but model '{embedding_model}' not found in tags")
            else:
                print(f"{ollama_label} WARNING: Server responded with status {resp.status_code}")
    except Exception as e:
        print(f"{ollama_label} OFFLINE (Could not connect to {ollama_url})")
    
    print("------------------------------------------\n")

    # 3. faster-whisper local transcription model — eager load
    print("--- Loading transcription model (faster-whisper) ---")
    try:
        whisper = get_whisper_service()
        await asyncio.to_thread(whisper.load)
        print(
            f"[Whisper] READY (model={whisper.model_size}, "
            f"device={whisper.device}, compute={whisper.compute_type})"
        )
    except Exception as e:
        print(f"[Whisper] FAILED to load: {e}")
        print("[Whisper] Transcription endpoint will return 503 until fixed.")
    print("------------------------------------------\n")

    yield

    # Cleanup on shutdown
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    print("--- Interview reminder scheduler stopped ---")

    job_deadline_task.cancel()
    try:
        await job_deadline_task
    except asyncio.CancelledError:
        pass
    print("--- Job deadline scheduler stopped ---")

    weekly_report_task.cancel()
    try:
        await weekly_report_task
    except asyncio.CancelledError:
        pass
    print("--- Weekly report scheduler stopped ---")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
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
app.include_router(ai_analysis_router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(external_auth.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(parametrage.router, prefix="/api")
app.include_router(team.router, prefix="/api")
app.include_router(superadmin_settings_router, prefix="/api")
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
