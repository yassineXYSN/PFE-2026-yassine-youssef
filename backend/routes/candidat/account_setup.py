from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header, Request
import tempfile
import os
import secrets
from typing import Optional, List
from datetime import datetime
import json

from .helpers import get_user_id_from_token, get_user_info_from_token, get_candidates_collection, get_user_metadata_from_token
from database.model import AccountSetupData
from database.mongodb_async import get_async_db
from services.ai_matching import AIMatchingService
from utils.account_analysis import parse_cv

router = APIRouter()

def calculate_profile_strength(profile: dict) -> dict:
    score = 0
    missing = []
    first_name = profile.get("first_name") or profile.get("firstName")
    last_name = profile.get("last_name") or profile.get("lastName")
    email = profile.get("email")
    has_basic = first_name and last_name and email
    
    if has_basic:
        score += 20
    else:
        if first_name: score += 7
        if last_name: score += 7
        if email: score += 6
        missing.append('info')
        
    if profile.get("bio") or profile.get("about"):
        score += 10
    else:
        missing.append('bio')
        
    skills = profile.get("skills")
    if skills and len(skills) > 0:
        score += 20
    else:
        missing.append('skills')
        
    exps = profile.get("experience") or profile.get("experiences")
    if exps and len(exps) > 0:
        score += 25
    else:
        missing.append('experience')
        
    edus = profile.education if hasattr(profile, 'education') else profile.get("education") or profile.get("educations")
    if edus and len(edus) > 0:
        score += 25
    else:
        missing.append('education')
        
    return {"score": min(100, max(0, score)), "missing": missing}


# ── File storage helpers ─────────────────────────────────────────────

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "static", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _save_upload(file_bytes: bytes, original_filename: str, user_id: str) -> str:
    """Save bytes to disk under static/uploads and return the relative path."""
    ext = os.path.splitext(original_filename)[1]
    disk_name = f"{user_id}_{secrets.token_hex(8)}{ext}"
    path = os.path.join(UPLOAD_DIR, disk_name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return f"static/uploads/{disk_name}"


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
    user_id, email = get_user_info_from_token(authorization)
    print(f"Authenticated user_id: {user_id} ({email})")

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
        file_path = _save_upload(cv_bytes, cv_file.filename, user_id)
        cv_info = {
            "filename": cv_file.filename,
            "content_type": cv_file.content_type,
            "size": len(cv_bytes),
            "file_path": file_path,
        }

    # 5. Collect certificate, experience, and education document files from dynamic form fields
    cert_files: dict = {}   # id_str -> file_info dict
    exp_files: dict = {}    # id_str -> file_info dict
    edu_files: dict = {}    # id_str -> file_info dict

    for field_name, field_value in form.multi_items():
        if field_name.startswith("certificate_file_") and hasattr(field_value, "filename"):
            cert_id = field_name[len("certificate_file_"):]
            file_bytes = await field_value.read()
            file_path = _save_upload(file_bytes, field_value.filename, user_id)
            cert_files[cert_id] = {
                "filename": field_value.filename,
                "content_type": field_value.content_type,
                "size": len(file_bytes),
                "file_path": file_path,
            }
        elif field_name.startswith("experience_file_") and hasattr(field_value, "filename"):
            exp_id = field_name[len("experience_file_"):]
            file_bytes = await field_value.read()
            file_path = _save_upload(file_bytes, field_value.filename, user_id)
            exp_files[exp_id] = {
                "filename": field_value.filename,
                "content_type": field_value.content_type,
                "size": len(file_bytes),
                "file_path": file_path,
            }
        elif field_name.startswith("education_file_") and hasattr(field_value, "filename"):
            edu_id = field_name[len("education_file_"):]
            file_bytes = await field_value.read()
            file_path = _save_upload(file_bytes, field_value.filename, user_id)
            edu_files[edu_id] = {
                "filename": field_value.filename,
                "content_type": field_value.content_type,
                "size": len(file_bytes),
                "file_path": file_path,
            }

    # 6. Patch file info into the certificate / experience / education records
    doc_data = form_data.model_dump()
    existing_cv_info = doc_data.pop("cv", None)

    certs_dump = doc_data.get("certificates", [])
    for cert in certs_dump:
        cert_id_str = str(cert.get("id", ""))
        if cert_id_str in cert_files:
            cert["document"] = cert_files[cert_id_str]

    exps_dump = doc_data.get("experiences", [])
    for exp in exps_dump:
        exp_id_str = str(exp.get("id", ""))
        if exp_id_str in exp_files:
            exp["document"] = exp_files[exp_id_str]

    edus_dump = doc_data.get("educations", [])
    for edu in edus_dump:
        edu_id_str = str(edu.get("id", ""))
        if edu_id_str in edu_files:
            edu["certificate"] = edu_files[edu_id_str]

    # 7. Resolve profilePicture: form value > OAuth avatar > DiceBear fallback
    doc_data["certificates"] = certs_dump
    doc_data["experiences"] = exps_dump
    doc_data["educations"] = edus_dump

    if not doc_data.get("profilePicture"):
        user_meta = get_user_metadata_from_token(authorization)
        oauth_avatar = user_meta.get("avatar_url") or user_meta.get("picture") or ""
        if oauth_avatar:
            doc_data["profilePicture"] = oauth_avatar
        else:
            doc_data["profilePicture"] = (
                f"https://api.dicebear.com/9.x/avataaars/svg?seed={user_id}"
            )

    document = {
        "user_id": user_id,
        "email": email,
        **doc_data,
        "cv": cv_info or existing_cv_info,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    strength_data = calculate_profile_strength(document)
    document["profileStrength"] = strength_data["score"]
    document["profileMissing"] = strength_data["missing"]

    print(f"Saving account setup for user_id={user_id}: {list(document.keys())}")
    print(f"  Certificates with files: {[c.get('name') for c in certs_dump if 'document' in c]}")
    print(f"  Experiences with files:   {[e.get('company') for e in exps_dump if 'document' in e]}")
    print(f"  Educations with files:    {[e.get('institution') for e in edus_dump if 'certificate' in e]}")

    # 8. Upsert into MongoDB
    collection = get_candidates_collection()
    result = collection.update_one(
        {"user_id": user_id},
        {"$set": document},
        upsert=True,
    )

    # 9. Trigger Vectorization
    try:
        db_async = get_async_db()
        ai_service = AIMatchingService(db=db_async)
        await ai_service.vectorize_and_save_profile(str(user_id))
        await ai_service.close()
    except Exception as ai_err:
        print(f"Failed to trigger automatic vectorization for {user_id}: {ai_err}")

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
        result = await parse_cv(pdf_path=tmp_path)
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

    if not user_doc:
        return {"is_setup_completed": False, "totp_enabled": False, "email_2fa_enabled": False}

    return {
        "is_setup_completed": True,
        "totp_enabled": user_doc.get("totp_enabled", False),
        "email_2fa_enabled": user_doc.get("email_2fa_enabled", False)
    }


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
