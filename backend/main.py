from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import connect_mongodb, connect_supabase
from . import auth
from .routes.candidat.account_setup import router as candidat_account_setup_router
from fastapi.staticfiles import StaticFiles
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Check database connections
    print("--- Starting up: Checking Database Connections ---")
    connect_mongodb()
    connect_supabase()
    yield


app = FastAPI(lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; refine for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directory exists
os.makedirs(os.path.join(os.path.dirname(__file__), "static"), exist_ok=True)
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

# Include auth router under its own prefix for organization
app.include_router(auth.router, prefix="/auth")

# Include candidat routes
app.include_router(candidat_account_setup_router, prefix="/candidat")


@app.get("/")
def read_root():
    return {"Hello": "World"}

