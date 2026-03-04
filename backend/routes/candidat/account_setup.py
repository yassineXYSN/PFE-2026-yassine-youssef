from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header
from typing import Optional
from datetime import datetime
import json
from bson import ObjectId
import os
import secrets

from ...database.mongodb import connect_mongodb
from ...database.supabase import get_supabase
from ...database.model import AccountSetupData

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────

def _get_user_id_from_token(authorization: str) -> str:
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


def _get_candidates_collection():
    """Return the MongoDB candidates collection."""
    client = connect_mongodb()
    if client is None:
        raise HTTPException(status_code=500, detail="Could not connect to MongoDB")
    db = client["nexthire"]
    return db["candidates"]


# ── Route ────────────────────────────────────────────────────────────

@router.post("/account-setup", tags=["candidat"])
async def account_setup(
    data: str = Form(...),
    cv: Optional[UploadFile] = File(None),
    authorization: Optional[str] = Header(None),
):
    """
    Receive the candidate account-setup form data and persist it to MongoDB.

    - **data**: JSON string containing the AccountSetupData fields.
    - **cv**: Optional CV file (PDF, DOC, DOCX).
    - **authorization**: Bearer token from Supabase auth.
    """

    # 1. Authenticate
    user_id = _get_user_id_from_token(authorization)
    print(f"Authenticated user_id: {user_id}")

    # 2. Parse & validate the JSON payload
    try:
        parsed = json.loads(data)
        form_data = AccountSetupData(**parsed)
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=422, detail=f"Invalid form data: {e}")

    # 3. Read the CV file bytes (if provided)
    cv_info = None
    if cv is not None:
        allowed_types = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]
        if cv.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="CV must be a PDF, DOC, or DOCX file")

        cv_bytes = await cv.read()
        cv_info = {
            "filename": cv.filename,
            "content_type": cv.content_type,
            "size": len(cv_bytes),
            "file_data": cv_bytes,  # stored as binary in MongoDB
        }

    # 4. Build the document
    document = {
        "user_id": user_id,
        **form_data.model_dump(),
        "cv": cv_info,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    print(f"Received account setup for user_id={user_id}: {document}")

    # 5. Upsert into MongoDB (update if already exists, insert otherwise)
    collection = _get_candidates_collection()
    result = collection.update_one(
        {"user_id": user_id},
        {"$set": document},
        upsert=True,
    )

    return {
        "message": "Account setup saved successfully",
        "user_id": user_id,
        "upserted": result.upserted_id is not None,
    }


@router.get("/account-setup/status", tags=["candidat"])
async def check_account_setup_status(authorization: Optional[str] = Header(None)):
    """
    Check if the candidate has completed their account setup.
    """
    try:
        user_id = _get_user_id_from_token(authorization)
    except Exception as e:
        return {"is_setup_completed": False}

    collection = _get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id})

    return {"is_setup_completed": user_doc is not None}


@router.get("/account-setup", tags=["candidat"])
async def get_account_setup(authorization: Optional[str] = Header(None)):
    """
    Get the candidate account-setup data from MongoDB.
    """
    user_id = _get_user_id_from_token(authorization)
    
    collection = _get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id})

    if not user_doc:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    # Remove internal MongoDB _id and return document
    if "_id" in user_doc:
        user_doc["_id"] = str(user_doc["_id"])
        
    # We do not return binary CV explicitly in this JSON response, 
    # but we will return file info if it exists.
    if "cv" in user_doc and isinstance(user_doc["cv"], dict) and "file_data" in user_doc["cv"]:
        user_doc["cv"].pop("file_data", None)

    return user_doc

from typing import Dict, Any

@router.put("/profile", tags=["candidat"])
async def update_profile(
    payload: Dict[str, Any],
    authorization: Optional[str] = Header(None)
):
    """
    Update the candidate profile data in MongoDB.
    """
    user_id = _get_user_id_from_token(authorization)
    
    # Extract fields that require mapping
    update_data = {}
    if "name" in payload:
        name_parts = payload["name"].split(maxsplit=1)
        update_data["firstName"] = name_parts[0] if len(name_parts) > 0 else ""
        update_data["lastName"] = name_parts[1] if len(name_parts) > 1 else ""
    if "location" in payload:
        update_data["address"] = payload["location"]
    
    # Direct mappings
    for field in ["title", "about", "experiences", "educations", "certificates", "languages", "skills", "hobbies", "profileImage", "coverImage"]:
        if field in payload:
            update_data[field] = payload[field]
            
    update_data["updated_at"] = datetime.utcnow()

    collection = _get_candidates_collection()
    collection.update_one(
        {"user_id": user_id},
        {"$set": update_data},
        upsert=True
    )

    return {"message": "Profile updated successfully"}


@router.post("/profile/upload-image", tags=["candidat"])
async def upload_profile_image(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    """
    Upload a profile or cover image and return the URL.
    """
    print("------- UPLOAD PROFILE IMAGE REQUEST RECEIVED -------")
    try:
        user_id = _get_user_id_from_token(authorization)
        print(f"User ID from token: {user_id}")
        
        # Ensure static uploads directory exists
        upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "static", "uploads")
        upload_dir = os.path.abspath(upload_dir)
        print(f"Upload directory resolved to: {upload_dir}")
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate random filename to prevent collisions
        ext = os.path.splitext(file.filename)[1]
        filename = f"{user_id}_{secrets.token_hex(8)}{ext}"
        filepath = os.path.join(upload_dir, filename)
        print(f"Saving file {file.filename} to {filepath}")
        
        # Save file
        file_bytes = await file.read()
        print(f"Read {len(file_bytes)} bytes from upload")
        with open(filepath, "wb") as f:
            f.write(file_bytes)
            
        # Construct URL (assuming backend runs on localhost:8000 for local dev)
        # In production, this should be an absolute URL or relative to API base
        url = f"http://localhost:8000/static/uploads/{filename}"
        print(f"File uploaded successfully! URL: {url}")
        
        return {"url": url}
    except Exception as e:
        print(f"ERROR uploading image: {e}")
        import traceback
        traceback.print_exc()
        raise
