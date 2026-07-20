import os
import secrets
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from database.mongodb_async import get_async_db
from middleware.auth import require_roles
from routers.candidates import HR_SIDE_ROLES
from utils.account_analysis import parse_cv_bytes
from utils.files import get_backend_root, get_upload_dir
from utils.uploads import DOC_EXTS, MAX_DOC_BYTES, validate_upload

router = APIRouter(prefix="/manual-candidates", tags=["HR Manual Candidates"])


async def _ensure_job_access(db, job_id: str, current_user: dict) -> dict:
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job_id")
    job = await db.hr_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    role = current_user.get("role")
    if role != "superadmin":
        if job.get("company_id") != current_user.get("company_id"):
            raise HTTPException(status_code=403, detail="Not authorized to access this job")
        if role == "chef_departement" and job.get("department_id") != current_user.get("department_id"):
            raise HTTPException(status_code=403, detail="Not authorized to access this job")
    return job


def _save_cv_upload(file_bytes: bytes, original_filename: str, prefix: str) -> tuple[str, str]:
    """Validate then save CV bytes under static/uploads. Returns (relative_path, ext)."""
    ext = validate_upload(original_filename, file_bytes, allowed_exts=DOC_EXTS, max_bytes=MAX_DOC_BYTES)
    upload_dir = get_upload_dir()
    disk_name = f"{prefix}_{secrets.token_hex(8)}{ext}"
    abs_path = os.path.join(upload_dir, disk_name)
    with open(abs_path, "wb") as f:
        f.write(file_bytes)
    return f"static/uploads/{disk_name}", ext


def _delete_staged_file(file_path: Optional[str]) -> None:
    if not file_path:
        return
    abs_path = os.path.join(get_backend_root(), file_path.replace("/", os.sep))
    try:
        if os.path.isfile(abs_path):
            os.remove(abs_path)
    except OSError:
        pass


@router.post("/parse")
async def parse_manual_candidate_cv(
    job_id: str = Form(...),
    cv: UploadFile = File(...),
    current_user: dict = Depends(require_roles(HR_SIDE_ROLES)),
):
    """
    Parse a single CV for a manually-added candidate. Saves the file to disk
    immediately (so it never needs re-uploading at confirm time), stages a
    record in ``hr_manual_cv_staging``, and returns the parsed profile for
    HR to review/edit before confirming.
    """
    db = get_async_db()
    job = await _ensure_job_access(db, job_id, current_user)

    filename = cv.filename or "cv"
    file_bytes = await cv.read()

    file_path, _ext = _save_cv_upload(file_bytes, filename, prefix=f"manualcv_{current_user['id']}")

    now = datetime.utcnow()
    staging_doc = {
        "job_id": job_id,
        "company_id": job.get("company_id"),
        "uploaded_by": current_user["id"],
        "filename": filename,
        "content_type": cv.content_type or "application/octet-stream",
        "size": len(file_bytes),
        "file_path": file_path,
        "status": "staged",
        "parsed_profile": None,
        "created_at": now,
        "updated_at": now,
    }
    insert_result = await db.hr_manual_cv_staging.insert_one(staging_doc)

    try:
        parsed = await parse_cv_bytes(file_bytes, filename)
    except Exception as e:
        _delete_staged_file(file_path)
        await db.hr_manual_cv_staging.delete_one({"_id": insert_result.inserted_id})
        raise HTTPException(status_code=500, detail=f"CV Parsing failed: {str(e)}")

    await db.hr_manual_cv_staging.update_one(
        {"_id": insert_result.inserted_id},
        {"$set": {"parsed_profile": parsed, "updated_at": datetime.utcnow()}},
    )

    return {
        "staged_id": str(insert_result.inserted_id),
        "filename": filename,
        "content_type": staging_doc["content_type"],
        "size": staging_doc["size"],
        "parsed": parsed,
    }


@router.delete("/staged/{staged_id}")
async def discard_staged_manual_candidate(
    staged_id: str,
    current_user: dict = Depends(require_roles(HR_SIDE_ROLES)),
):
    """Best-effort cleanup when HR discards a candidate during review."""
    if not ObjectId.is_valid(staged_id):
        raise HTTPException(status_code=400, detail="Invalid staged_id")

    db = get_async_db()
    staged = await db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)})
    if not staged:
        return {"ok": True, "already_removed": True}

    if current_user.get("role") != "superadmin" and staged.get("company_id") != current_user.get("company_id"):
        raise HTTPException(status_code=403, detail="Not authorized to discard this staged CV")

    _delete_staged_file(staged.get("file_path"))
    await db.hr_manual_cv_staging.delete_one({"_id": ObjectId(staged_id)})
    return {"ok": True}
