import os
import re
import secrets
import uuid
from datetime import datetime
from typing import List, Optional

import pymysql.err
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from passlib.context import CryptContext
from pydantic import BaseModel

from database.model import Certificate, Education, Experience, Hobby, JobPreferences, Language, Skill
from database.mongodb_async import get_async_db
from database.mysql import get_db as get_mysql_db, row
from middleware.auth import require_roles
from routers.candidates import HR_SIDE_ROLES
from services.ai_matching import AIMatchingService
from utils.account_analysis import parse_cv_bytes
from utils.email_utils import send_email
from utils.files import get_backend_root, get_upload_dir
from utils.uploads import DOC_EXTS, MAX_DOC_BYTES, validate_upload
from utils.verification_tokens import issue_verification_token

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class ManualCandidateProfile(BaseModel):
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    birthDate: Optional[str] = ""
    title: Optional[str] = ""
    address: Optional[str] = ""
    linkedinUrl: Optional[str] = ""
    hobbies: Optional[List[Hobby]] = []
    skills: Optional[List[Skill]] = []
    languages: Optional[List[Language]] = []
    educations: Optional[List[Education]] = []
    experiences: Optional[List[Experience]] = []
    certificates: Optional[List[Certificate]] = []
    jobPreferences: Optional[JobPreferences] = JobPreferences()


class ManualCandidateConfirmItem(BaseModel):
    staged_id: str
    profile: ManualCandidateProfile


class ManualCandidateConfirmRequest(BaseModel):
    job_id: str
    candidates: List[ManualCandidateConfirmItem]


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


async def _mark_staged_confirmed(db, staged_id, now: datetime) -> None:
    """Isolated so tests can monkeypatch this one specific write to force a
    failure after the candidate/application docs have already been inserted."""
    await db.hr_manual_cv_staging.update_one(
        {"_id": staged_id},
        {"$set": {"status": "confirmed", "updated_at": now}},
    )


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

    # Reuse the same company+department authorization _parse and _confirm
    # already enforce via the staged CV's job, instead of duplicating a
    # bespoke (and here, department-blind) check a third time.
    await _ensure_job_access(db, staged["job_id"], current_user)

    _delete_staged_file(staged.get("file_path"))
    await db.hr_manual_cv_staging.delete_one({"_id": ObjectId(staged_id)})
    return {"ok": True}


_SNAPSHOT_WHITELIST = [
    "about", "certificates", "created_at", "cv", "educations",
    "experiences", "firstName", "hobbies", "jobPreferences",
    "languages", "lastName", "skills", "title",
]


def _normalize_email(email: Optional[str]) -> str:
    return (email or "").strip().lower()


def _find_existing_user(email: str) -> Optional[dict]:
    """Case-insensitive lookup of a real, login-capable account by email."""
    db_gen = get_mysql_db()
    conn = next(db_gen)
    try:
        with conn.cursor() as cursor:
            return row(
                cursor,
                "SELECT u.id AS id, p.role AS role FROM users u "
                "JOIN profiles p ON p.id = u.id WHERE LOWER(u.email) = %s",
                (email,),
            )
    finally:
        try: next(db_gen)
        except StopIteration: pass


def _create_candidate_account(email: str) -> tuple[str, str, str]:
    """
    Creates a real MySQL users+profiles row for a brand-new manually-added
    candidate (role='candidat', status='pending') with a random password,
    and issues a 7-day activation token. Returns (user_id, password, token).
    Raises ValueError if the email was registered concurrently.
    """
    user_id = str(uuid.uuid4())
    password = secrets.token_urlsafe(12)
    password_hash = pwd_context.hash(password)

    db_gen = get_mysql_db()
    conn = next(db_gen)
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, password_hash),
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status) VALUES (%s, 'candidat', 'pending')",
                (user_id,),
            )
            token = issue_verification_token(cursor, email)
        conn.commit()
    except pymysql.err.IntegrityError:
        conn.rollback()
        raise ValueError("Email already registered")
    finally:
        try: next(db_gen)
        except StopIteration: pass
    return user_id, password, token


def _delete_candidate_account(user_id: str) -> None:
    """Rollback helper: deletes the MySQL users row (cascades to profiles)."""
    db_gen = get_mysql_db()
    conn = next(db_gen)
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    except Exception as cleanup_err:
        print(f"Failed to roll back candidate account {user_id} after confirm error: {cleanup_err}")
    finally:
        try: next(db_gen)
        except StopIteration: pass


def _send_invite_email(background_tasks: BackgroundTasks, email: str, first_name: str,
                        password: str, token: str, job_title: str) -> None:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    verify_link = f"{frontend_url}/candidat/verify-email?token={token}"
    content = (
        f"Bonjour {first_name or ''},\n\n"
        f"Vous avez été ajouté(e) comme candidat(e) pour le poste \"{job_title}\" sur HumatiQ.\n\n"
        f"Un compte a été créé pour vous afin de suivre votre candidature et de passer, le cas "
        f"échéant, les quiz techniques et entretiens directement depuis la plateforme.\n\n"
        f"Voici vos identifiants de connexion :\n"
        f"  Email        : {email}\n"
        f"  Mot de passe : {password}\n\n"
        f"Avant de pouvoir vous connecter, activez votre compte en cliquant sur ce lien "
        f"(valable 7 jours) :\n\n{verify_link}\n\n"
        f"Nous vous recommandons de changer votre mot de passe après votre première connexion.\n\n"
        f"Bienvenue sur HumatiQ !\n"
        f"L'équipe HumatiQ"
    )
    background_tasks.add_task(send_email, email, "Votre compte HumatiQ", content)


def _send_linked_notice_email(background_tasks: BackgroundTasks, email: str, first_name: str, job_title: str) -> None:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    login_url = f"{frontend_url}/candidat/login"
    content = (
        f"Bonjour {first_name or ''},\n\n"
        f"Un recruteur a ajouté votre candidature pour le poste \"{job_title}\" sur HumatiQ, "
        f"en utilisant le compte existant associé à cette adresse email.\n\n"
        f"Connectez-vous pour la suivre et passer, le cas échéant, les quiz techniques et "
        f"entretiens :\n{login_url}\n\n"
        f"L'équipe HumatiQ"
    )
    background_tasks.add_task(send_email, email, "Nouvelle candidature ajoutée à votre compte", content)


@router.post("/confirm")
async def confirm_manual_candidates(
    body: ManualCandidateConfirmRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(HR_SIDE_ROLES)),
):
    """
    Batch-confirm reviewed manual candidates. Each item resolves to one of
    three outcomes, handled independently so one item's failure never blocks
    the rest of the batch:
      - "invited": no account existed for the email, so a real candidat
        account is created (pending activation) and an invite email is sent.
      - "linked": the email already belongs to a real candidat account, so
        that candidate is auto-applied to this job using their existing
        profile (or, if they had already applied, this is a no-op).
      - "failed": validation error, staged CV problem, or an email that
        belongs to a non-candidat account.
    """
    db = get_async_db()
    job = await _ensure_job_access(db, body.job_id, current_user)
    job_title = job.get("title") or ""

    invited = []
    linked = []
    failed = []

    for item in body.candidates:
        cand_result = None
        app_result = None
        new_account_user_id = None
        try:
            if not ObjectId.is_valid(item.staged_id):
                raise ValueError("Invalid staged_id")
            staged = await db.hr_manual_cv_staging.find_one({"_id": ObjectId(item.staged_id)})
            if not staged:
                raise ValueError("Staged CV not found")
            if staged.get("status") != "staged":
                raise ValueError(f"Staged CV already {staged.get('status')}")
            if staged.get("job_id") != body.job_id:
                raise ValueError("Staged CV does not belong to this job")

            profile = item.profile.model_dump()
            email = _normalize_email(profile.pop("email", None))
            phone = profile.pop("phone", None)
            first_name = profile.get("firstName") or ""

            if not email or not EMAIL_RE.match(email):
                raise ValueError("A valid email is required")

            existing_user = _find_existing_user(email)

            if existing_user:
                if existing_user["role"] != "candidat":
                    raise ValueError("This email belongs to a non-candidate account")

                existing_user_id = existing_user["id"]
                now = datetime.utcnow()

                existing_app = await db.job_applications.find_one({
                    "candidate_id": existing_user_id, "job_id": body.job_id,
                })
                if existing_app:
                    await _mark_staged_confirmed(db, staged["_id"], now)
                    linked.append({
                        "staged_id": item.staged_id,
                        "candidate_id": existing_user_id,
                        "application_id": str(existing_app["_id"]),
                        "already_applied": True,
                    })
                    continue

                candidate_profile = await db.candidates.find_one({"user_id": existing_user_id})
                snapshot = {
                    k: candidate_profile.get(k)
                    for k in _SNAPSHOT_WHITELIST if candidate_profile and k in candidate_profile
                }
                app_doc = {
                    "candidate_id": existing_user_id,
                    "job_id": body.job_id,
                    "motivation_letter": None,
                    "status": "new",
                    "source": "hr_manual",
                    "profile_snapshot": snapshot,
                    "applied_at": now,
                }
                app_result = await db.job_applications.insert_one(app_doc)
                await _mark_staged_confirmed(db, staged["_id"], now)

                _send_linked_notice_email(
                    background_tasks, email,
                    (candidate_profile or {}).get("firstName") or first_name,
                    job_title,
                )

                linked.append({
                    "staged_id": item.staged_id,
                    "candidate_id": existing_user_id,
                    "application_id": str(app_result.inserted_id),
                })
                continue

            # No existing account for this email: create a real one.
            new_account_user_id, password, token = _create_candidate_account(email)

            now = datetime.utcnow()
            candidate_doc = {
                "user_id": new_account_user_id,
                "email": email,
                "phone": phone,
                "source": "hr_manual",
                "added_by": current_user["id"],
                "company_id": job.get("company_id"),
                "setup_completed": True,
                "cv": {
                    "filename": staged.get("filename"),
                    "content_type": staged.get("content_type"),
                    "size": staged.get("size"),
                    "file_path": staged.get("file_path"),
                },
                **profile,
                "created_at": now,
                "updated_at": now,
            }
            cand_result = await db.candidates.insert_one(candidate_doc)

            snapshot = {k: candidate_doc.get(k) for k in _SNAPSHOT_WHITELIST if k in candidate_doc}
            app_doc = {
                "candidate_id": new_account_user_id,
                "job_id": body.job_id,
                "motivation_letter": None,
                "status": "new",
                "source": "hr_manual",
                "profile_snapshot": snapshot,
                "applied_at": now,
            }
            app_result = await db.job_applications.insert_one(app_doc)

            try:
                ai_service = AIMatchingService(db=db)
                await ai_service.vectorize_and_save_profile(new_account_user_id, by_user_id=True)
                await ai_service.close()
            except Exception as vec_err:
                print(f"Failed to vectorize manual candidate {new_account_user_id}: {vec_err}")

            await _mark_staged_confirmed(db, staged["_id"], now)

            _send_invite_email(background_tasks, email, first_name, password, token, job_title)

            invited.append({
                "staged_id": item.staged_id,
                "candidate_id": str(cand_result.inserted_id),
                "application_id": str(app_result.inserted_id),
                "user_id": new_account_user_id,
            })
        except Exception as e:
            error_msg = str(e)
            if cand_result is not None:
                try:
                    await db.candidates.delete_one({"_id": cand_result.inserted_id})
                except Exception as cleanup_err:
                    print(f"Failed to roll back candidate {cand_result.inserted_id} "
                          f"after confirm error: {cleanup_err}")
            if app_result is not None:
                try:
                    await db.job_applications.delete_one({"_id": app_result.inserted_id})
                except Exception as cleanup_err:
                    print(f"Failed to roll back job_application {app_result.inserted_id} "
                          f"after confirm error: {cleanup_err}")
            if new_account_user_id is not None:
                _delete_candidate_account(new_account_user_id)
            failed.append({"staged_id": item.staged_id, "error": error_msg})

    return {"invited": invited, "linked": linked, "failed": failed}
