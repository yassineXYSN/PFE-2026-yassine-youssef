"""
Candidat settings routes – persist user preferences in MongoDB.
"""

from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
from datetime import datetime, date

from bson import ObjectId

from database.mongodb import connect_mongodb
from database.mysql import get_db
from .helpers import (
    get_user_id_from_token,
    get_user_info_from_token,
    get_candidates_collection,
)

router = APIRouter()


def _get_db():
    """Return the HumatiQ MongoDB database (synchronous client)."""
    client = connect_mongodb()
    if client is None:
        raise HTTPException(status_code=500, detail="Could not connect to MongoDB")
    return client["HumatiQ"]


def _sanitize(value: Any) -> Any:
    """Recursively convert Mongo/BSON types into JSON-serialisable values."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    if isinstance(value, bytes):
        return f"<{len(value)} bytes binary omitted>"
    return value


@router.get("/settings", tags=["candidat"])
async def get_settings(authorization: Optional[str] = Header(None)):
    """Return the candidate's saved settings from MongoDB."""
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()

    user_doc = collection.find_one({"user_id": user_id}, {"settings": 1, "totp_enabled": 1, "email_2fa_enabled": 1})
    if not user_doc:
        return {}

    settings = user_doc.get("settings", {})
    settings["twofa"] = {
        "totp_enabled": user_doc.get("totp_enabled", False),
        "email_2fa_enabled": user_doc.get("email_2fa_enabled", False)
    }
    return settings


@router.put("/settings", tags=["candidat"])
async def update_settings(
    payload: Dict[str, Any],
    authorization: Optional[str] = Header(None),
):
    """Replace the candidate's settings object in MongoDB (upsert)."""
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()

    # Build the update — always persist the settings object
    update_fields = {"settings": payload, "settings_updated_at": datetime.utcnow()}

    # ── Sync 2FA flags to the root of the document ──────────────────
    # The login flow (account-setup/status) reads root-level
    # `totp_enabled` and `email_2fa_enabled`.  When the user toggles
    # 2FA off in the settings UI the payload arrives with a `twofa`
    # sub-object – we must propagate those values to the root so the
    # next login honours the change.
    twofa = payload.get("twofa") if isinstance(payload, dict) else None
    if twofa and isinstance(twofa, dict):
        if "totp_enabled" in twofa:
            update_fields["totp_enabled"] = bool(twofa["totp_enabled"])
        if "email_2fa_enabled" in twofa:
            update_fields["email_2fa_enabled"] = bool(twofa["email_2fa_enabled"])

    collection.update_one(
        {"user_id": user_id},
        {
            "$set": update_fields,
            "$setOnInsert": {"user_id": user_id},
        },
        upsert=True,
    )

    return {"status": "ok"}


@router.get("/interview-consent", tags=["candidat"])
async def get_interview_consent(authorization: Optional[str] = Header(None)):
    """Return whether the candidate has dismissed the pre-interview AI notice."""
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()

    doc = collection.find_one(
        {"user_id": user_id}, {"interview_ai_notice_dismissed": 1}
    )
    dismissed = bool(doc.get("interview_ai_notice_dismissed", False)) if doc else False
    return {"dismissed": dismissed}


@router.post("/interview-consent/dismiss", tags=["candidat"])
async def dismiss_interview_consent(authorization: Optional[str] = Header(None)):
    """
    Persist the candidate's "don't show again" choice for the pre-interview
    AI-analysis notice. Stored at the root of the candidate document so it can
    double as an auditable record of when the notice was acknowledged (RGPD).
    """
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()

    collection.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "interview_ai_notice_dismissed": True,
                "interview_ai_notice_dismissed_at": datetime.utcnow(),
            },
            "$setOnInsert": {"user_id": user_id},
        },
        upsert=True,
    )

    return {"status": "ok"}


@router.get("/export-data", tags=["candidat"])
async def export_personal_data(authorization: Optional[str] = Header(None)):
    """
    RGPD Art. 15 & 20 — right of access and data portability.

    Returns, as a downloadable JSON file, all the personal data we hold about
    the authenticated candidate across our collections.
    """
    user_id, email = get_user_info_from_token(authorization)
    db = _get_db()

    profile = db["candidates"].find_one({"user_id": user_id})
    applications = list(db["job_applications"].find({"candidate_id": user_id}))
    saved_jobs = list(db["saved_jobs"].find({"candidate_id": user_id}))
    interviews = list(db["hr_interviews"].find({"candidate_email": email})) if email else []
    notifications = list(db["notifications"].find({"user_id": user_id}))

    export = {
        "export_metadata": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "user_id": user_id,
            "email": email,
            "notice": "Personal data export generated under RGPD Articles 15 and 20.",
        },
        "profile": _sanitize(profile),
        "applications": _sanitize(applications),
        "saved_jobs": _sanitize(saved_jobs),
        "interviews": _sanitize(interviews),
        "notifications": _sanitize(notifications),
    }

    filename = f"humatiq-data-export-{datetime.utcnow().strftime('%Y%m%d')}.json"
    return JSONResponse(
        content=export,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/account", tags=["candidat"])
async def delete_account(authorization: Optional[str] = Header(None)):
    """
    RGPD Art. 17 — right to erasure ("right to be forgotten").

    Permanently deletes the candidate's data from every collection and removes
    the underlying authentication account. This action is irreversible.
    """
    user_id, email = get_user_info_from_token(authorization)
    db = _get_db()

    deleted: Dict[str, int] = {}
    deleted["profile"] = db["candidates"].delete_many({"user_id": user_id}).deleted_count
    deleted["applications"] = db["job_applications"].delete_many({"candidate_id": user_id}).deleted_count
    deleted["saved_jobs"] = db["saved_jobs"].delete_many({"candidate_id": user_id}).deleted_count
    deleted["notifications"] = db["notifications"].delete_many({"user_id": user_id}).deleted_count
    if email:
        deleted["interviews"] = db["hr_interviews"].delete_many({"candidate_email": email}).deleted_count

    # Delete from MariaDB (cascades to profiles via FK).
    auth_deleted = False
    db_gen = get_db()
    db_conn = next(db_gen)
    try:
        with db_conn.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        db_conn.commit()
        auth_deleted = True
    except Exception as exc:
        db_conn.rollback()
        print(f"WARNING: failed to delete MariaDB user {user_id}: {exc}")
    finally:
        try: next(db_gen)
        except StopIteration: pass

    return {"status": "deleted", "records_deleted": deleted, "auth_account_deleted": auth_deleted}
