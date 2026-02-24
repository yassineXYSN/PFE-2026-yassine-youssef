from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import connect_mongodb, connect_supabase
from . import auth


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

# Include auth router under its own prefix for organization
app.include_router(auth.router, prefix="/auth")


@app.get("/")
def read_root():
    return {"Hello": "World"}

