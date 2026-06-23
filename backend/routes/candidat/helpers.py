"""
Shared helpers for candidat routes.
"""
import os
from fastapi import HTTPException
from jose import jwt, JWTError
from dotenv import load_dotenv
from database.mongodb import connect_mongodb

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env'))

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"


def _decode_token(authorization: str) -> dict:
    """Decode and verify the local HS256 JWT, return the payload dict."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("id") or not payload.get("email"):
            raise HTTPException(status_code=401, detail="Invalid token: missing claims")
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")


def get_user_id_from_token(authorization: str) -> str:
    """Verify the JWT and return the user id."""
    return _decode_token(authorization)["id"]


def get_user_info_from_token(authorization: str) -> tuple[str, str]:
    """Verify the JWT and return (user_id, email)."""
    payload = _decode_token(authorization)
    return payload["id"], payload["email"]


def get_user_metadata_from_token(authorization: str) -> dict:
    """Return user metadata from JWT claims (never raises)."""
    try:
        payload = _decode_token(authorization)
        return {"role": payload.get("role"), "id": payload.get("id")}
    except Exception:
        return {}


def get_candidates_collection():
    """Return the MongoDB candidates collection."""
    client = connect_mongodb()
    if client is None:
        raise HTTPException(status_code=500, detail="Could not connect to MongoDB")
    db = client["HumatiQ"]
    return db["candidates"]
