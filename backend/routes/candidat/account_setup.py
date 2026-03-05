from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header
from typing import Optional
from datetime import datetime
import json

from .helpers import get_user_id_from_token, get_candidates_collection
from ...database.model import AccountSetupData

router = APIRouter()


# ── POST Account Setup ───────────────────────────────────────────────

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
    user_id = get_user_id_from_token(authorization)
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
    collection = get_candidates_collection()
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


# ── GET Account Setup Status ────────────────────────────────────────

@router.get("/account-setup/status", tags=["candidat"])
async def check_account_setup_status(authorization: Optional[str] = Header(None)):
    """
    Check if the candidate has completed their account setup.
    """
    try:
        user_id = get_user_id_from_token(authorization)
    except Exception as e:
        return {"is_setup_completed": False}

    collection = get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id})

    return {"is_setup_completed": user_doc is not None}


# ── GET Account Setup Data ───────────────────────────────────────────

@router.get("/account-setup", tags=["candidat"])
async def get_account_setup(authorization: Optional[str] = Header(None)):
    """
    Get the candidate account-setup data from MongoDB.
    """
    user_id = get_user_id_from_token(authorization)

    collection = get_candidates_collection()
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
