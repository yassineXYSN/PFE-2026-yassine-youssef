from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header
from typing import Optional
from datetime import datetime
import json

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
