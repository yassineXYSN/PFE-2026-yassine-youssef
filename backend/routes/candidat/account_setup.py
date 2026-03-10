from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header, Request
import tempfile
import os
from typing import Optional, List
from datetime import datetime
import json

from .helpers import get_user_id_from_token, get_candidates_collection
from ...database.model import AccountSetupData
from ...utils.cv_parser import parse_cv

router = APIRouter()


# ── POST Account Setup ───────────────────────────────────────────────

@router.post("/account-setup", tags=["candidat"])
async def account_setup(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """
    Receive the candidate account-setup form data and persist it to MongoDB.

    Accepts a multipart form with:
    - **data**: JSON string containing the AccountSetupData fields.
    - **cv**: Optional CV file (PDF, DOC, DOCX).
    - **certificate_file_{id}**: Optional certificate document file(s).
    - **experience_file_{id}**: Optional experience document file(s).
    - **authorization**: Bearer token from Supabase auth.
    """

    # 1. Authenticate
    user_id = get_user_id_from_token(authorization)
    print(f"Authenticated user_id: {user_id}")

    # 2. Read multipart form
    form = await request.form()

    # 3. Parse & validate the JSON payload
    data_str = form.get("data")
    if not data_str:
        raise HTTPException(status_code=422, detail="Missing 'data' field")
    try:
        parsed = json.loads(data_str)
        form_data = AccountSetupData(**parsed)
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=422, detail=f"Invalid form data: {e}")

    # 4. Process the main CV file
    cv_info = None
    cv_file = form.get("cv")
    if cv_file is not None and hasattr(cv_file, "filename"):
        allowed_types = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]
        if cv_file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="CV must be a PDF, DOC, or DOCX file")
        cv_bytes = await cv_file.read()
        cv_info = {
            "filename": cv_file.filename,
            "content_type": cv_file.content_type,
            "size": len(cv_bytes),
            "file_data": cv_bytes,
        }

    # 5. Collect certificate and experience document files from dynamic form fields
    cert_files: dict = {}   # id_str -> file_info dict
    exp_files: dict = {}    # id_str -> file_info dict

    for field_name, field_value in form.multi_items():
        if field_name.startswith("certificate_file_") and hasattr(field_value, "filename"):
            cert_id = field_name[len("certificate_file_"):]
            file_bytes = await field_value.read()
            cert_files[cert_id] = {
                "filename": field_value.filename,
                "content_type": field_value.content_type,
                "size": len(file_bytes),
                "file_data": file_bytes,
            }
        elif field_name.startswith("experience_file_") and hasattr(field_value, "filename"):
            exp_id = field_name[len("experience_file_"):]
            file_bytes = await field_value.read()
            exp_files[exp_id] = {
                "filename": field_value.filename,
                "content_type": field_value.content_type,
                "size": len(file_bytes),
                "file_data": file_bytes,
            }

    # 6. Patch file info into the certificate / experience records
    certs_dump = form_data.model_dump().get("certificates", [])
    for cert in certs_dump:
        cert_id_str = str(cert.get("id", ""))
        if cert_id_str in cert_files:
            cert["document"] = cert_files[cert_id_str]

    exps_dump = form_data.model_dump().get("experiences", [])
    for exp in exps_dump:
        exp_id_str = str(exp.get("id", ""))
        if exp_id_str in exp_files:
            exp["document"] = exp_files[exp_id_str]

    # 7. Build the document
    doc_data = form_data.model_dump()
    doc_data["certificates"] = certs_dump
    doc_data["experiences"] = exps_dump

    document = {
        "user_id": user_id,
        **doc_data,
        "cv": cv_info,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    print(f"Saving account setup for user_id={user_id}: {list(document.keys())}")
    print(f"  Certificates with files: {[c.get('name') for c in certs_dump if 'document' in c]}")
    print(f"  Experiences with files:   {[e.get('company') for e in exps_dump if 'document' in e]}")

    # 8. Upsert into MongoDB
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


# ── POST Parse CV ───────────────────────────────────────────────────

@router.post("/account-setup/parse-cv", tags=["candidat"])
async def parse_cv_endpoint(
    cv: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """
    Parse a CV file and return the extracted JSON data matching AccountSetupData.
    """
    # 1. Authenticate
    try:
        user_id = get_user_id_from_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {e}")

    # 2. Check file extension
    if not cv.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for parsing.")

    # 3. Save bytes to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await cv.read()
        tmp.write(content)
        tmp_path = tmp.name

    # 4. Parse CV
    try:
        result = parse_cv(pdf_path=tmp_path, use_api=True)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"CV Parsing failed: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


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
