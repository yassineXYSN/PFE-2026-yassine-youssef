"""
Demo-account owner-gated 2FA helpers.

All demo state lives in MongoDB (db "HumatiQ"):
  - hr_profiles            existing collection; new fields is_demo, demo_expires_at
  - demo_access_codes      one-time 6-digit codes, ~10 min TTL
  - demo_trusted_devices   at most one non-revoked device per user_id
  - demo_login_audit       append-only audit trail

Codes and login alerts are emailed only to OWNER_2FA_EMAIL, never to the demo
account holder. Email dispatch is sync (`utils.email_utils.send_email`) and
must be scheduled via `BackgroundTasks.add_task`, never awaited directly.
"""

import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from utils.email_utils import send_email

OWNER_2FA_EMAIL = os.getenv("OWNER_2FA_EMAIL", "yassinechtourou03@gmail.com")

CODE_TTL_MINUTES = 10


def _as_aware_utc(dt):
    """Coerce a naive datetime (assumed UTC) to a tz-aware UTC datetime."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def get_demo_profile(mongo_db, user_id):
    """Return the hr_profiles doc for user_id if is_demo is truthy, else None."""
    profile = mongo_db.hr_profiles.find_one({"_id": user_id})
    if profile and profile.get("is_demo"):
        return profile
    return None


def is_demo_expired(profile: dict) -> bool:
    """True if profile['demo_expires_at'] is set and is in the past (UTC)."""
    expires_at = profile.get("demo_expires_at") if profile else None
    if not expires_at:
        return False
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    expires_at = _as_aware_utc(expires_at)
    return datetime.now(timezone.utc) > expires_at


def device_label_from_ua(user_agent: str) -> str:
    """Very small UA -> human label mapper, e.g. 'Chrome on Windows'."""
    ua = (user_agent or "")
    ua_lower = ua.lower()

    if "edg/" in ua_lower or "edge" in ua_lower:
        browser = "Edge"
    elif "chrome" in ua_lower and "chromium" not in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        browser = "Safari"
    else:
        browser = None

    if "windows" in ua_lower:
        os_name = "Windows"
    elif "mac os" in ua_lower or "macintosh" in ua_lower:
        os_name = "Mac"
    elif "android" in ua_lower:
        os_name = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower or "ios" in ua_lower:
        os_name = "iOS"
    elif "linux" in ua_lower:
        os_name = "Linux"
    else:
        os_name = None

    if browser and os_name:
        return f"{browser} on {os_name}"
    if browser:
        return browser
    if os_name:
        return os_name
    return "Unknown device"


def find_trusted_device(mongo_db, user_id, device_id):
    """Return the non-revoked demo_trusted_devices doc matching (user_id, device_id), or None."""
    if not device_id:
        return None
    return mongo_db.demo_trusted_devices.find_one({
        "user_id": user_id,
        "device_id": device_id,
        "revoked": {"$ne": True},
    })


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def issue_demo_code(mongo_db, user_id, device_id, ip, user_agent) -> str:
    """
    Invalidate prior unconsumed codes for user_id, insert a fresh 6-digit code
    (expires_at = now + CODE_TTL_MINUTES), and return the new code.
    """
    mongo_db.demo_access_codes.update_many(
        {"user_id": user_id, "consumed": {"$ne": True}},
        {"$set": {"consumed": True}},
    )
    now = datetime.now(timezone.utc)
    code = _generate_code()
    mongo_db.demo_access_codes.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "device_id": device_id,
        "code": code,
        "ip": ip,
        "user_agent": user_agent,
        "created_at": now,
        "expires_at": now + timedelta(minutes=CODE_TTL_MINUTES),
        "consumed": False,
    })
    return code


def verify_demo_code(mongo_db, user_id, device_id, code) -> bool:
    """
    True iff a matching, unconsumed, unexpired code exists for (user_id, device_id, code).
    Marks the code consumed on success.
    """
    record = mongo_db.demo_access_codes.find_one({
        "user_id": user_id,
        "device_id": device_id,
        "code": code,
        "consumed": {"$ne": True},
    })
    if not record:
        return False
    expires_at = _as_aware_utc(record.get("expires_at"))
    if expires_at is None or datetime.now(timezone.utc) > expires_at:
        return False
    mongo_db.demo_access_codes.update_one(
        {"_id": record["_id"]},
        {"$set": {"consumed": True}},
    )
    return True


def trust_device_single(mongo_db, user_id, device_id, ip, user_agent):
    """
    Revoke all other non-revoked devices for user_id (returns their device_ids),
    then upsert `device_id` as the single trusted device.
    """
    others_cursor = mongo_db.demo_trusted_devices.find({
        "user_id": user_id,
        "device_id": {"$ne": device_id},
        "revoked": {"$ne": True},
    })
    revoked_ids = [d["device_id"] for d in others_cursor]
    if revoked_ids:
        mongo_db.demo_trusted_devices.update_many(
            {"user_id": user_id, "device_id": {"$in": revoked_ids}},
            {"$set": {"revoked": True}},
        )

    now = datetime.now(timezone.utc)
    existing = mongo_db.demo_trusted_devices.find_one({"user_id": user_id, "device_id": device_id})
    if existing:
        mongo_db.demo_trusted_devices.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "ip": ip,
                "label": device_label_from_ua(user_agent),
                "last_seen_at": now,
                "revoked": False,
            }},
        )
    else:
        mongo_db.demo_trusted_devices.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "device_id": device_id,
            "label": device_label_from_ua(user_agent),
            "ip": ip,
            "created_at": now,
            "last_seen_at": now,
            "revoked": False,
        })
    return revoked_ids


def revoke_device(mongo_db, device_id) -> bool:
    """Set revoked=true on the demo_trusted_devices doc matching device_id."""
    result = mongo_db.demo_trusted_devices.update_one(
        {"device_id": device_id},
        {"$set": {"revoked": True}},
    )
    return result.matched_count > 0


def mint_device_id() -> str:
    return secrets.token_urlsafe(32)


def audit(mongo_db, user_id, email, event, ip=None, user_agent=None, device_id=None) -> None:
    mongo_db.demo_login_audit.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "email": email,
        "event": event,
        "ip": ip,
        "user_agent": user_agent,
        "device_id": device_id,
        "created_at": datetime.now(timezone.utc),
    })


def send_owner_code_email(background_tasks, code, account_email, ip, user_agent) -> None:
    subject = "Code d'accès démo HumatiQ"
    content = (
        f"Bonjour,\n\nUne tentative de connexion sur le compte démo {account_email} "
        f"nécessite votre validation.\n\nCode d'accès (valable {CODE_TTL_MINUTES} minutes) : {code}\n\n"
        f"IP : {ip or 'inconnue'}\nAppareil : {user_agent or 'inconnu'}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nL'équipe HumatiQ"
    )
    background_tasks.add_task(send_email, OWNER_2FA_EMAIL, subject, content)


def send_owner_login_alert(background_tasks, account_email, ip, user_agent, device_label) -> None:
    subject = "Connexion démo HumatiQ"
    content = (
        f"Bonjour,\n\nUne connexion a eu lieu sur le compte démo {account_email}.\n\n"
        f"Appareil : {device_label or 'inconnu'}\nIP : {ip or 'inconnue'}\nUser-Agent : {user_agent or 'inconnu'}\n\n"
        "Si vous n'êtes pas à l'origine de cette action, révoquez l'appareil depuis SuperAdmin > Sécurité Démo.\n\n"
        "L'équipe HumatiQ"
    )
    background_tasks.add_task(send_email, OWNER_2FA_EMAIL, subject, content)
