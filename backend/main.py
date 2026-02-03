from fastapi import FastAPI
from contextlib import asynccontextmanager
from .database import connect_mongodb, connect_supabase

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Check database connections
    print("--- Starting up: Checking Database Connections ---")
    connect_mongodb()
    connect_supabase()
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/")
def read_root():
    return {"Hello": "World"}

