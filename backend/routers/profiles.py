from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Optional
import re
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
    
    # Isolation for Company SuperAdmin (Company SuperAdmin only sees their company)
    if current_user["role"] == "company_admin":
        # Get the requester's company_id from their own profile
        requester_profile = db.hr_profiles.find_one({"_id": current_user["id"]})
        if not requester_profile or not requester_profile.get("company_id"):
            raise HTTPException(status_code=403, detail="Company Admin profile missing company_id")
        query["company_id"] = requester_profile["company_id"]
    elif company_id:
        # Global SuperAdmin or other roles can filter by company_id if provided
        query["company_id"] = company_id
        
    if department_id:
        query["department_id"] = department_id
        
    profiles_cursor = db.hr_profiles.find(query).skip(skip).limit(limit)
    profiles = list(profiles_cursor)
    
    return profiles

@router.get("/{profile_id}", response_model=ProfileBase)
async def get_profile(
    profile_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    # Check superadmins collection first
    profile = db.superadmins.find_one({"_id": profile_id})
    if profile:
        return profile
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
    email_clean = (email or "").strip()
    # Check superadmins collection first
    profile = db.superadmins.find_one({"email": email_clean})
    if not profile:
        profile = db.superadmins.find_one(
            {"email": {"$regex": f"^{re.escape(email_clean)}$", "$options": "i"}}
        )
    if profile:
        return profile
    # Correspondance insensible à la casse (JWT / saisie peuvent différer)
    profile = db.hr_profiles.find_one({"email": email_clean})
    if not profile:
        profile = db.hr_profiles.find_one(
            {"email": {"$regex": f"^{re.escape(email_clean)}$", "$options": "i"}}
        )
    if not profile:
        # Fallback to candidates collection
        candidate = db.candidates.find_one({"email": email_clean})
        if not candidate:
            candidate = db.candidates.find_one(
                {"email": {"$regex": f"^{re.escape(email_clean)}$", "$options": "i"}}
            )
        if candidate:
            candidate["_id"] = candidate.get("user_id", str(candidate.get("_id", "")))
            candidate["first_name"] = candidate.get("firstName", "")
            candidate["last_name"] = candidate.get("lastName", "")
            candidate["role"] = "candidat"
            candidate["experience"] = candidate.get("experiences", [])
            candidate["education"] = candidate.get("educations", [])
            candidate["bio"] = candidate.get("about", "")
            candidate["phone"] = candidate.get("phone", "")
            return candidate
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
    
    # Access check: Only SuperAdmin or the user themselves can create the profile
    # Case-insensitive string comparison for robust UUID matching
    is_self = str(current_user["id"]).lower().strip() == str(profile_data["_id"]).lower().strip()
    is_superadmin = (current_user["role"] or "").lower() == "superadmin"
    
    # Fallback: If not superadmin in token, check superadmins collection (in case Supabase metadata is out of sync)
    if not is_superadmin and not is_self:
        db = get_db()
        if db.superadmins.find_one({"_id": current_user["id"]}):
            is_superadmin = True
            print(f"DEBUG: SuperAdmin verified via superadmins collection for {current_user['id']}")

    if not is_superadmin and not is_self:
        raise HTTPException(status_code=403, detail="Not authorized to create this profile")

    # Add timestamps
    from datetime import datetime
    profile_data["created_at"] = datetime.utcnow()
    profile_data["updated_at"] = datetime.utcnow()
    
    print(f"DEBUG: Inserting profile into MongoDB for User: {profile_data.get('email')} (ID: {profile_data['_id']})")
    
    try:
        db.hr_profiles.insert_one(profile_data)
    except Exception as e:
        print(f"DEBUG: Profile insertion failed for {profile_data.get('email')}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to persist profile in database")
    
    created_profile = db.hr_profiles.find_one({"_id": profile_data["_id"]})
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
    # Reject path traversal: profile_id must be a valid UUID (Supabase auth IDs are UUIDs)
    if not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', profile_id, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Invalid profile ID format")

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
