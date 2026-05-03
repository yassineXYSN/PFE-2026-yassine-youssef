import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import connect_mongodb, connect_supabase
from . import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- Starting up: Checking Database Connections ---")
    connect_mongodb()
    connect_supabase()
    yield


app = FastAPI(lifespan=lifespan)

# CORS — restrict to frontend origin in production via ALLOWED_ORIGINS env var
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth router under its own prefix for organization
app.include_router(auth.router, prefix="/auth")


@app.get("/")
def read_root():
    return {"Hello": "World"}

