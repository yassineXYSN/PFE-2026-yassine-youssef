"""
Candidat settings routes – persist user preferences in MongoDB.
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional, Dict, Any
from datetime import datetime

from .helpers import get_user_id_from_token, get_candidates_collection

router = APIRouter()


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
