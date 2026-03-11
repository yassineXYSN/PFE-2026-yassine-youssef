"""
Shared helpers for candidat routes.
"""

from fastapi import HTTPException
from database.mongodb import connect_mongodb
from database.supabase import get_supabase


def get_user_id_from_token(authorization: str) -> str:
    """Verify the Supabase JWT and return the user id."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ", 1)[1]
    sb = get_supabase()
    try:
        user_response = sb.auth.get_user(token)
        print(f"Authenticated user: {user_response.user.id}")
        return user_response.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def get_candidates_collection():
    """Return the MongoDB candidates collection."""
    client = connect_mongodb()
    if client is None:
        raise HTTPException(status_code=500, detail="Could not connect to MongoDB")
    db = client["HumatiQ"]
    return db["candidates"]
