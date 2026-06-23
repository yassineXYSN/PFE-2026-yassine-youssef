from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from bson.objectid import ObjectId
from database.mongodb_async import get_async_db
from middleware.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/jobs/saved", tags=["Saved Jobs"])

# get_db is deprecated in favor of get_async_db from database.mongodb_async

@router.get("", response_model=List[str])
async def get_saved_jobs(current_user: dict = Depends(get_current_user)):
    db = get_async_db()
    cursor = db.saved_jobs.find({"candidate_id": current_user["id"]})
    saved = await cursor.to_list(length=100)
    return [str(item["job_id"]) for item in saved]

@router.post("/{job_id}")
async def toggle_save_job(job_id: str, current_user: dict = Depends(get_current_user)):
    db = get_async_db()
    
    # Check if job exists
    if not ObjectId.is_valid(job_id):
         raise HTTPException(status_code=400, detail="Invalid Job ID")
    
    job = await db.hr_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = await db.saved_jobs.find_one({
        "candidate_id": current_user["id"],
        "job_id": job_id
    })
    
    if existing:
        await db.saved_jobs.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    else:
        await db.saved_jobs.insert_one({
            "candidate_id": current_user["id"],
            "job_id": job_id,
            "saved_at": datetime.utcnow()
        })
        return {"saved": True}
