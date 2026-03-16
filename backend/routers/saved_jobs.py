from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from bson.objectid import ObjectId
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/jobs/saved", tags=["Saved Jobs"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

@router.get("", response_model=List[str])
async def get_saved_jobs(current_user: dict = Depends(get_current_user)):
    db = get_db()
    saved = list(db.saved_jobs.find({"candidate_id": current_user["id"]}))
    return [str(item["job_id"]) for item in saved]

@router.post("/{job_id}")
async def toggle_save_job(job_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    # Check if job exists
    if not ObjectId.is_valid(job_id):
         raise HTTPException(status_code=400, detail="Invalid Job ID")
    
    job = db.hr_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = db.saved_jobs.find_one({
        "candidate_id": current_user["id"],
        "job_id": job_id
    })
    
    if existing:
        db.saved_jobs.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    else:
        db.saved_jobs.insert_one({
            "candidate_id": current_user["id"],
            "job_id": job_id,
            "saved_at": datetime.utcnow()
        })
        return {"saved": True}
