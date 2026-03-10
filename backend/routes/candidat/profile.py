from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header
from fastapi.responses import Response, FileResponse
from typing import Optional, Dict, Any
from datetime import datetime
import os
import secrets

from .helpers import get_user_id_from_token, get_candidates_collection

router = APIRouter()

# Base directory for resolving file_path values stored in MongoDB
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_UPLOAD_DIR = os.path.join(_BACKEND_ROOT, "static", "uploads")
os.makedirs(_UPLOAD_DIR, exist_ok=True)


def _resolve_file(file_info: dict):
    """
    Return (abs_path, content_type, filename) from a file_info dict.

    Supports two storage modes:
    - **disk** (new): file_info has ``file_path`` relative to backend root.
    - **legacy**: file_info has ``file_data`` bytes stored in MongoDB.

    Returns ``None`` when the file_info contains neither.
    """
    if not file_info:
        return None

    # New disk-based storage
    if file_info.get("file_path"):
        abs_path = os.path.join(_BACKEND_ROOT, file_info["file_path"])
        if os.path.isfile(abs_path):
            return abs_path, file_info.get("content_type", "application/octet-stream"), file_info.get("filename", "file")

    # Legacy: binary in MongoDB
    if file_info.get("file_data"):
        return None  # handled separately by caller

    return None


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

    # Strip binary blobs (legacy data) before JSON serialisation
    if "cv" in user_doc and isinstance(user_doc["cv"], dict):
        user_doc["cv"].pop("file_data", None)

    for cert in user_doc.get("certificates", []):
        if isinstance(cert, dict) and isinstance(cert.get("document"), dict):
            cert["document"].pop("file_data", None)

    for exp in user_doc.get("experiences", []):
        if isinstance(exp, dict) and isinstance(exp.get("document"), dict):
            exp["document"].pop("file_data", None)

    for edu in user_doc.get("educations", []):
        if isinstance(edu, dict) and isinstance(edu.get("certificate"), dict):
            edu["certificate"].pop("file_data", None)

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
        "phone", "github", "twitter", "website", "cv",
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


# ── Upload Document (generic, saves to disk and returns metadata) ────

@router.post("/profile/upload-document", tags=["candidat"])
async def upload_document(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """
    Upload a document (CV, certificate, experience doc, education cert)
    to the server filesystem. Returns metadata to be stored in MongoDB
    via the normal PUT /profile flow.
    """
    user_id = get_user_id_from_token(authorization)

    file_bytes = await file.read()
    ext = os.path.splitext(file.filename)[1]
    disk_name = f"{user_id}_{secrets.token_hex(8)}{ext}"
    disk_path = os.path.join(_UPLOAD_DIR, disk_name)
    with open(disk_path, "wb") as f:
        f.write(file_bytes)

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(file_bytes),
        "file_path": f"static/uploads/{disk_name}",
    }


# ── Download CV ──────────────────────────────────────────────────────

@router.get("/profile/cv/download", tags=["candidat"])
async def download_cv(authorization: Optional[str] = Header(None)):
    """Download the candidate's uploaded CV."""
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id}, {"cv": 1})

    if not user_doc or not user_doc.get("cv"):
        raise HTTPException(status_code=404, detail="CV not found")

    cv = user_doc["cv"]
    resolved = _resolve_file(cv)
    if resolved:
        abs_path, content_type, filename = resolved
        return FileResponse(abs_path, media_type=content_type, filename=filename)

    # Legacy fallback: binary in MongoDB
    if cv.get("file_data"):
        return Response(
            content=bytes(cv["file_data"]),
            media_type=cv.get("content_type", "application/pdf"),
            headers={"Content-Disposition": f'attachment; filename="{cv.get("filename", "cv.pdf")}"'}
        )

    raise HTTPException(status_code=404, detail="CV file not found")


# ── Download Certificate Document ────────────────────────────────────

@router.get("/profile/certificates/{cert_id}/download", tags=["candidat"])
async def download_certificate(cert_id: str, authorization: Optional[str] = Header(None)):
    """Download a certificate document by certificate ID."""
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id}, {"certificates": 1})

    if not user_doc:
        raise HTTPException(status_code=404, detail="Profile not found")

    for cert in user_doc.get("certificates", []):
        if str(cert.get("id")) == cert_id:
            doc = cert.get("document")
            if not doc:
                raise HTTPException(status_code=404, detail="Certificate document not found")

            resolved = _resolve_file(doc)
            if resolved:
                abs_path, content_type, filename = resolved
                return FileResponse(abs_path, media_type=content_type, filename=filename)

            # Legacy fallback
            if doc.get("file_data"):
                return Response(
                    content=bytes(doc["file_data"]),
                    media_type=doc.get("content_type", "application/pdf"),
                    headers={"Content-Disposition": f'attachment; filename="{doc.get("filename", "certificate.pdf")}"'}
                )

            raise HTTPException(status_code=404, detail="Certificate file not found")

    raise HTTPException(status_code=404, detail="Certificate not found")


# ── Download Experience Document ─────────────────────────────────────

@router.get("/profile/experiences/{exp_id}/download", tags=["candidat"])
async def download_experience_document(exp_id: str, authorization: Optional[str] = Header(None)):
    """Download a document attached to an experience entry."""
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id}, {"experiences": 1})

    if not user_doc:
        raise HTTPException(status_code=404, detail="Profile not found")

    for exp in user_doc.get("experiences", []):
        if str(exp.get("id")) == exp_id:
            doc = exp.get("document")
            if not doc:
                raise HTTPException(status_code=404, detail="Experience document not found")

            resolved = _resolve_file(doc)
            if resolved:
                abs_path, content_type, filename = resolved
                return FileResponse(abs_path, media_type=content_type, filename=filename)

            # Legacy fallback
            if doc.get("file_data"):
                return Response(
                    content=bytes(doc["file_data"]),
                    media_type=doc.get("content_type", "application/pdf"),
                    headers={"Content-Disposition": f'attachment; filename="{doc.get("filename", "document.pdf")}"'}
                )

            raise HTTPException(status_code=404, detail="Experience file not found")

    raise HTTPException(status_code=404, detail="Experience not found")


# ── Download Education Certificate ───────────────────────────────────

@router.get("/profile/educations/{edu_id}/download", tags=["candidat"])
async def download_education_certificate(edu_id: str, authorization: Optional[str] = Header(None)):
    """Download a certificate attached to an education entry."""
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id}, {"educations": 1})

    if not user_doc:
        raise HTTPException(status_code=404, detail="Profile not found")

    for edu in user_doc.get("educations", []):
        if str(edu.get("id")) == edu_id:
            cert = edu.get("certificate")
            if not cert:
                raise HTTPException(status_code=404, detail="Education certificate not found")

            resolved = _resolve_file(cert)
            if resolved:
                abs_path, content_type, filename = resolved
                return FileResponse(abs_path, media_type=content_type, filename=filename)

            # Legacy fallback
            if cert.get("file_data"):
                return Response(
                    content=bytes(cert["file_data"]),
                    media_type=cert.get("content_type", "application/pdf"),
                    headers={"Content-Disposition": f'attachment; filename="{cert.get("filename", "certificate.pdf")}"'}
                )

            raise HTTPException(status_code=404, detail="Education certificate file not found")

    raise HTTPException(status_code=404, detail="Education not found")
