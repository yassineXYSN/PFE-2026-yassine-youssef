from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from models.application import JobApplicationBase, JobApplicationCreate
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/applications", tags=["applications"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

@router.post("/apply", response_model=JobApplicationBase)
async def apply_to_job(
    application: JobApplicationCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "candidat":
        raise HTTPException(status_code=403, detail="Only candidates can apply to jobs")
    
    db = get_db()
    
    # 1. Verify job exists
    job = db.hr_jobs.find_one({"_id": ObjectId(application.job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 2. Check if already applied
    existing_app = db.job_applications.find_one({
        "candidate_id": current_user["id"],
        "job_id": application.job_id
    })
    if existing_app:
        raise HTTPException(status_code=400, detail="You have already applied to this job")

    # 3. Get candidate profile snapshot
    profile = db.candidates.find_one({"user_id": current_user["id"]})
    if not profile:
        profile = db.hr_profiles.find_one({"_id": current_user["id"]})
        
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    
    # Define exact fields to include in snapshot
    whitelist = [
        "address", "birthDate", "certificates", "created_at", "cv", 
        "educations", "experiences", "firstName", "hobbies", 
        "jobPreferences", "languages", "lastName", "linkedinUrl", 
        "profilePicture", "skills", "title", "about", "coverImage", 
        "github", "phone", "profileImage", "twitter", "website", "embedding"
    ]
    
    snapshot = {field: profile.get(field) for field in whitelist if field in profile}
    
    # 4. Create application
    new_app = {
        "candidate_id": current_user["id"],
        "job_id": application.job_id,
        "motivation_letter": application.motivation_letter,
        "status": "pending",
        "profile_snapshot": snapshot,
        "applied_at": datetime.utcnow()
    }
    
    result = db.job_applications.insert_one(new_app)
    new_app["_id"] = str(result.inserted_id)
    
    return new_app

@router.get("/my-applications", response_model=List[JobApplicationBase])
async def get_my_applications(current_user: dict = Depends(get_current_user)):
    db = get_db()
    apps = list(db.job_applications.find({"candidate_id": current_user["id"]}))
    for app in apps:
        app["_id"] = str(app["_id"])
    return apps

@router.get("/check/{job_id}")
async def check_application_status(job_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    existing_app = db.job_applications.find_one({
        "candidate_id": current_user["id"],
        "job_id": job_id
    })
    return {"applied": existing_app is not None}
