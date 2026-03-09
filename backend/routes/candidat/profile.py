from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from typing import Optional, Dict, Any
from datetime import datetime
import os
import secrets

from .helpers import get_user_id_from_token, get_candidates_collection

router = APIRouter()


# ── GET Profile ──────────────────────────────────────────────────────

@router.get("/profile", tags=["candidat"])
async def get_profile(authorization: Optional[str] = Header(None)):
    """
    Get the candidate profile data from MongoDB.
    """
    user_id = get_user_id_from_token(authorization)

    collection = get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id})

    if not user_doc:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    # Remove internal MongoDB _id and return document
    if "_id" in user_doc:
        user_doc["_id"] = str(user_doc["_id"])

    # Strip binary blobs before JSON serialisation
    if "cv" in user_doc and isinstance(user_doc["cv"], dict):
        user_doc["cv"].pop("file_data", None)

    for cert in user_doc.get("certificates", []):
        if isinstance(cert, dict) and isinstance(cert.get("document"), dict):
            cert["document"].pop("file_data", None)

    for exp in user_doc.get("experiences", []):
        if isinstance(exp, dict) and isinstance(exp.get("document"), dict):
            exp["document"].pop("file_data", None)

    return user_doc


# ── PUT Profile ──────────────────────────────────────────────────────

@router.put("/profile", tags=["candidat"])
async def update_profile(
    payload: Dict[str, Any],
    authorization: Optional[str] = Header(None)
):
    """
    Update the candidate profile data in MongoDB.
    """
    user_id = get_user_id_from_token(authorization)

    # Extract fields that require mapping
    update_data = {}
    # Support both separate firstName/lastName (new) and legacy combined 'name' (fallback)
    if "firstName" in payload or "lastName" in payload:
        if "firstName" in payload:
            update_data["firstName"] = payload["firstName"]
        if "lastName" in payload:
            update_data["lastName"] = payload["lastName"]
    elif "name" in payload:
        name_parts = payload["name"].split(maxsplit=1)
        update_data["firstName"] = name_parts[0] if len(name_parts) > 0 else ""
        update_data["lastName"] = name_parts[1] if len(name_parts) > 1 else ""
    if "location" in payload:
        update_data["address"] = payload["location"]

    # Direct mappings
    for field in [
        "title", "about", "experiences", "educations", "certificates",
        "languages", "skills", "hobbies", "profileImage", "coverImage",
        "phone", "github", "twitter", "website",
    ]:
        if field in payload:
            update_data[field] = payload[field]

    # LinkedIn: frontend sends 'linkedin', MongoDB stores as 'linkedinUrl'
    if "linkedin" in payload:
        update_data["linkedinUrl"] = payload["linkedin"]

    update_data["updated_at"] = datetime.utcnow()

    collection = get_candidates_collection()
    collection.update_one(
        {"user_id": user_id},
        {"$set": update_data},
        upsert=True,
    )

    return {"message": "Profile updated successfully"}


# ── Upload Image ─────────────────────────────────────────────────────

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
        user_id = get_user_id_from_token(authorization)
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

        # Construct URL
        url = f"http://localhost:8000/static/uploads/{filename}"
        print(f"File uploaded successfully! URL: {url}")

        return {"url": url}
    except Exception as e:
        print(f"ERROR uploading image: {e}")
        import traceback
        traceback.print_exc()
        raise
