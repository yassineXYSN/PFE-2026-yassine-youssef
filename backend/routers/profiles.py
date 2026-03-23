from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Optional
from bson import ObjectId
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from models.profile import ProfileBase, ProfileCreate, ProfileUpdate
import os
import shutil
import uuid

router = APIRouter(prefix="/profiles", tags=["profiles"])

def get_db():
    try:
        client = connect_mongodb()
        if not client:
             raise Exception("MongoClient returned None")
    except Exception as e:
        print(f"DEBUG: MongoDB connection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")
    return client["HumatiQ"]

@router.get("/", response_model=List[ProfileBase])
async def get_profiles(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    company_id: Optional[str] = None,
    department_id: Optional[str] = None
):
    db = get_db()
    query = {}
    if company_id:
        query["company_id"] = company_id
    if department_id:
        query["department_id"] = department_id
        
    profiles_cursor = db.hr_profiles.find(query).skip(skip).limit(limit)
    profiles = list(profiles_cursor)
    
    # Optional: fetch related company and department names
    # This can be complex in MongoDB without aggregation, but let's keep it simple for now
    
    return profiles

@router.get("/{profile_id}", response_model=ProfileBase)
async def get_profile(
    profile_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    profile = db.hr_profiles.find_one({"_id": profile_id})
    if not profile:
        # Fallback to candidates collection
        profile = db.candidates.find_one({"user_id": profile_id})
        if not profile:
            print(f"DEBUG: Profile not found in MongoDB (hr_profiles or candidates) for ID: {profile_id}")
            raise HTTPException(status_code=404, detail=f"Profile not found for ID {profile_id}")
        # Map fields for ProfileBase if coming from candidates
        profile["_id"] = profile.get("user_id")
        profile["first_name"] = profile.get("firstName")
        profile["last_name"] = profile.get("lastName")
        profile["role"] = "candidat"
        # Add these mappings to ensure consistency with ProfileBase
        profile["experience"] = profile.get("experiences", [])
        profile["education"] = profile.get("educations", [])
        profile["bio"] = profile.get("about", "")
        profile["phone"] = profile.get("phone", "")
        
    return profile

@router.get("/by-email/{email}", response_model=ProfileBase)
async def get_profile_by_email(
    email: str
    # Note: Can't depend on get_current_user here because passwordless login check happens BEFORE the user is authenticated.
):
    db = get_db()
    profile = db.hr_profiles.find_one({"email": email})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.post("/", response_model=ProfileBase, status_code=status.HTTP_201_CREATED)
async def create_profile(
    profile_in: ProfileCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    if db.hr_profiles.find_one({"_id": profile_in.id}):
        raise HTTPException(status_code=400, detail="Profile with this ID already exists")
    
    # We use the Supabase Auth UUID as the _id in MongoDB
    profile_data = profile_in.model_dump()
    profile_data["_id"] = profile_data.pop("id")
    
    # Add timestamps
    from datetime import datetime
    profile_data["created_at"] = datetime.utcnow()
    profile_data["updated_at"] = datetime.utcnow()
    
    db.hr_profiles.insert_one(profile_data)
    
    created_profile = db.hr_profiles.find_one({"_id": profile_in.id})
    return created_profile

@router.put("/{profile_id}", response_model=ProfileBase)
async def update_profile(
    profile_id: str,
    profile_in: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    update_data = {k: v for k, v in profile_in.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
        
    from datetime import datetime
    update_data["updated_at"] = datetime.utcnow()
    
    result = db.hr_profiles.update_one(
        {"_id": profile_id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    updated = db.hr_profiles.find_one({"_id": profile_id})
    return updated

@router.post("/{profile_id}/avatar")
async def upload_profile_avatar(
    profile_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a profile avatar and store it on disk. Returns the public URL."""
    # Ensure profile exists
    db = get_db()
    
    # Validate content type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Validate file size (max 5 MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be under 5 MB")

    # Build storage path: static/avatars/<profile_id>/<uuid>.<ext>
    ext = os.path.splitext(file.filename)[-1] or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    base_dir = os.path.dirname(os.path.abspath(__file__))
    avatar_dir = os.path.join(base_dir, "..", "static", "avatars", profile_id)
    os.makedirs(avatar_dir, exist_ok=True)
    avatar_path = os.path.join(avatar_dir, filename)

    with open(avatar_path, "wb") as f:
        f.write(contents)

    # Public URL (served by FastAPI StaticFiles at /static)
    avatar_url = f"/static/avatars/{profile_id}/{filename}"

    # Persist avatar_url in DB
    from datetime import datetime
    db.hr_profiles.update_one(
        {"_id": profile_id},
        {"$set": {"avatar_url": avatar_url, "updated_at": datetime.utcnow()}}
    )

    return {"avatar_url": avatar_url}

@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    result = db.hr_profiles.delete_one({"_id": profile_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    return None
