from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header
from fastapi.responses import Response, FileResponse
from typing import Optional, Dict, Any
from datetime import datetime
import os
import secrets

from .helpers import get_user_id_from_token, get_user_info_from_token, get_candidates_collection
from .account_setup import calculate_profile_strength
from database.mongodb_async import get_async_db
from services.ai_matching import AIMatchingService
from utils.files import resolve_file, get_upload_dir, get_backend_root

router = APIRouter()

_BACKEND_ROOT = get_backend_root()
_UPLOAD_DIR = get_upload_dir()


# Logic moved to utils/files.py
def _resolve_file(file_info: dict):
    return resolve_file(file_info)


def _build_rating_summary(user_doc: dict):
    raw_ratings = user_doc.get("ratings", [])
    ratings = raw_ratings if isinstance(raw_ratings, list) else []

    valid_rates = []
    for rating in ratings:
        try:
            parsed_rate = int(rating.get("rate"))
            if 1 <= parsed_rate <= 5:
                valid_rates.append(parsed_rate)
        except (TypeError, ValueError, AttributeError):
            continue

    return {
        "ratings_average": round(sum(valid_rates) / len(valid_rates), 1) if valid_rates else None,
        "ratings_count": len(ratings),
    }


def _build_verification_response(record: Optional[dict]) -> dict:
    if not isinstance(record, dict):
        return {
            "status": "pending",
            "note": "",
            "created_at": None,
            "updated_at": None,
            "reviewed_by": None,
            "has_review": False,
        }

    status = record.get("status")
    if status not in {"pending", "verified", "rejected"}:
        status = "pending"

    return {
        "status": status,
        "note": record.get("note") or "",
        "created_at": str(record.get("created_at")) if record.get("created_at") else None,
        "updated_at": str(record.get("updated_at")) if record.get("updated_at") else None,
        "reviewed_by": record.get("reviewed_by") if isinstance(record.get("reviewed_by"), dict) else None,
        "has_review": True,
    }


def _decorate_profile_qualifications(user_doc: dict) -> None:
    verification_map = user_doc.get("qualification_verifications", {})
    if not isinstance(verification_map, dict):
        verification_map = {}

    field_map = {
        "educations": "certificate",
        "experiences": "document",
        "certificates": "document",
    }

    for category, document_field in field_map.items():
        category_items = user_doc.get(category, [])
        category_verifications = verification_map.get(category, {})
        if not isinstance(category_items, list):
            user_doc[category] = []
            continue
        if not isinstance(category_verifications, dict):
            category_verifications = {}

        decorated_items = []
        for item in category_items:
            if not isinstance(item, dict):
                decorated_items.append(item)
                continue

            item_copy = dict(item)
            document = item_copy.get(document_field)
            if isinstance(document, dict):
                document_copy = dict(document)
                document_copy.pop("file_data", None)
                item_copy[document_field] = document_copy

            item_id = str(item_copy.get("id")) if item_copy.get("id") is not None else None
            item_copy["verification"] = _build_verification_response(
                category_verifications.get(item_id) if item_id else None
            )
            decorated_items.append(item_copy)

        user_doc[category] = decorated_items


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

    _decorate_profile_qualifications(user_doc)

    user_doc.update(_build_rating_summary(user_doc))
    user_doc.pop("ratings", None)

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
    user_id, email = get_user_info_from_token(authorization)

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
        "phone", "github", "twitter", "website", "cv", "target_profile",
    ]:
        if field in payload:
            update_data[field] = payload[field]

    # LinkedIn: frontend sends 'linkedin', MongoDB stores as 'linkedinUrl'
    if "linkedin" in payload:
        update_data["linkedinUrl"] = payload["linkedin"]

    collection = get_candidates_collection()
    existing_profile = collection.find_one({"user_id": user_id}) or {}

    merged_profile = {
        **existing_profile,
        **update_data,
        "user_id": user_id,
        "email": existing_profile.get("email") or email,
    }
    strength_data = calculate_profile_strength(merged_profile)

    update_data["profileStrength"] = strength_data["score"]
    update_data["profileMissing"] = strength_data["missing"]
    update_data["updated_at"] = datetime.utcnow()

    collection.update_one(
        {"user_id": user_id},
        {"$set": update_data},
        upsert=True,
    )

    # 9. Trigger Vectorization
    try:
        db_async = get_async_db()
        ai_service = AIMatchingService(db=db_async)
        await ai_service.vectorize_and_save_profile(str(user_id), by_user_id=True)
        await ai_service.close()
    except Exception as ai_err:
        print(f"Failed to trigger automatic vectorization for {user_id}: {ai_err}")

    return {
        "message": "Profile updated successfully",
        "profileStrength": strength_data["score"],
        "profileMissing": strength_data["missing"],
    }


# ── PATCH Target Profile ─────────────────────────────────────────────

@router.patch("/profile/target-profile", tags=["candidat"])
async def set_target_profile(
    payload: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    """Save the candidate's chosen career target profile."""
    user_id = get_user_id_from_token(authorization)
    target = (payload.get("target_profile") or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="target_profile is required")
    collection = get_candidates_collection()
    collection.update_one(
        {"user_id": user_id},
        {"$set": {"target_profile": target, "updated_at": datetime.utcnow()}},
        upsert=False,
    )
    return {"message": "Target profile saved", "target_profile": target}


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
