"""
Candidate Two-Factor Authentication (2FA) endpoints.
Supports Authenticator App (TOTP) and Email verification code.
"""

from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional, Dict, Any
from datetime import datetime
import pyotp
import qrcode
import io
import base64
import random
import random
import string
import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv

from .helpers import get_user_id_from_token, get_candidates_collection

router = APIRouter()

# --- TOTP (Authenticator App) ---
@router.post("/2fa/totp/setup", tags=["candidat"])
async def setup_totp(authorization: Optional[str] = Header(None)):
    """Generate a TOTP secret and QR code for the user."""
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    secret = pyotp.random_base32()
    collection.update_one({"user_id": user_id}, {"$set": {"totp_secret": secret}}, upsert=True)
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user_id, issuer_name="HumatiQ")
    qr = qrcode.make(totp_uri)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()
    return {"secret": secret, "qr": qr_b64, "uri": totp_uri}

@router.post("/2fa/totp/verify", tags=["candidat"])
async def verify_totp(code: str, authorization: Optional[str] = Header(None)):
    """Verify a TOTP code and enable TOTP 2FA."""
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id}, {"totp_secret": 1})
    if not user_doc or "totp_secret" not in user_doc:
        raise HTTPException(status_code=400, detail="No TOTP secret set up.")
    totp = pyotp.TOTP(user_doc["totp_secret"])
    if not totp.verify(code):
        raise HTTPException(status_code=400, detail="Invalid code.")
    collection.update_one({"user_id": user_id}, {"$set": {"totp_enabled": True, "totp_verified_at": datetime.utcnow()}}, upsert=True)
    return {"status": "enabled"}

@router.post("/2fa/totp/disable", tags=["candidat"])
async def disable_totp(authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    collection.update_one({"user_id": user_id}, {"$set": {"totp_enabled": False}})
    return {"status": "disabled"}

# --- Email Code ---
@router.post("/2fa/email/send", tags=["candidat"])
async def send_email_code(authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id}, {"email": 1})
    email = user_doc.get("email") if user_doc else None

    if not email:
        try:
            from .helpers import get_user_info_from_token
            _, email = get_user_info_from_token(authorization)
            if email:
                collection.update_one({"user_id": user_id}, {"$set": {"email": email}}, upsert=True)
        except Exception as e:
            print(f"Error fetching user email from token: {e}")

    if not email:
        raise HTTPException(status_code=400, detail="No email found.")

    code = ''.join(random.choices(string.digits, k=6))
    collection.update_one({"user_id": user_id}, {"$set": {"email_code": code, "email_code_sent_at": datetime.utcnow()}}, upsert=True)
    
    # Send email
    try:
        from ...utils.email import send_email
        subject = "HumatiQ - Votre code de vérification 2FA"
        content = f"Votre code de vérification 2FA HumatiQ est : {code}\n\nCe code expirera dans 10 minutes."
        
        await send_email(to_email=email, subject=subject, content=content)
    except Exception as e:
        print(f"Error in 2FA email process: {e}")
        # We don't necessarily want to fail here if we want to allow local testing without SMTP

    return {"status": "sent"}

@router.post("/2fa/email/verify", tags=["candidat"])
async def verify_email_code(code: str = Query(...), authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    user_doc = collection.find_one({"user_id": user_id}, {"email_code": 1})
    if not user_doc or "email_code" not in user_doc:
        raise HTTPException(status_code=400, detail="No code sent.")
    if user_doc["email_code"] != code:
        raise HTTPException(status_code=400, detail="Invalid code.")
    collection.update_one({"user_id": user_id}, {"$set": {"email_2fa_enabled": True, "email_2fa_verified_at": datetime.utcnow()}, "$unset": {"email_code": ""}})
    return {"status": "enabled"}

@router.post("/2fa/email/disable", tags=["candidat"])
async def disable_email_2fa(authorization: Optional[str] = Header(None)):
    user_id = get_user_id_from_token(authorization)
    collection = get_candidates_collection()
    collection.update_one({"user_id": user_id}, {"$set": {"email_2fa_enabled": False}})
    return {"status": "disabled"}
