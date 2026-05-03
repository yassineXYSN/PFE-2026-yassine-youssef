import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import connect_postgres
from . import auth
from .routers import settings as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- Starting up: Checking Database Connection ---")
    connect_postgres()
    yield


app = FastAPI(lifespan=lifespan)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth")
app.include_router(settings_router.router)


@app.get("/")
def read_root():
    return {"service": "NextHire AI API", "status": "ok"}
