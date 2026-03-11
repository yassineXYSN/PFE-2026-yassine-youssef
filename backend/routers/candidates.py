from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user

router = APIRouter(prefix="/candidates", tags=["HR Candidates"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

def serialize_mongo(obj):
    """Recursively convert ObjectId, datetime, and bytes to string for JSON serialization."""
    if isinstance(obj, list):
        return [serialize_mongo(item) for item in obj]
    if isinstance(obj, dict):
        return {k: serialize_mongo(v) for k, v in obj.items()}
    if isinstance(obj, (ObjectId, datetime)):
        return str(obj)
    if isinstance(obj, bytes):
        # Simply return a placeholder for binary data to avoid bloated JSON
        return "[Binary Data]"
    return obj

@router.get("")
async def get_all_candidates(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Returns all candidate profiles from the 'candidates' collection for HR view.
    """
    try:
        db = get_db()
        candidates_cursor = db.candidates.find({}).skip(skip).limit(limit)
        
        raw_candidates = list(candidates_cursor)
        print(f"DEBUG: Found {len(raw_candidates)} candidates")
        
        serialized_candidates = serialize_mongo(raw_candidates)
        return serialized_candidates
    except Exception as e:
        import traceback
        print(f"ERROR in get_all_candidates: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
