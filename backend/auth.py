import secrets
import uuid
import pymysql.err
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Body, Depends, HTTPException, BackgroundTasks, Request
from passlib.context import CryptContext
from database.mysql import get_db, row
from database.mongodb import connect_mongodb
from dependencies import create_access_token
from middleware.auth import get_current_user, require_roles
from utils.email_utils import send_email
import os
from utils.verification_tokens import (
    issue_verification_token,
    consume_verification_token,
    invalidate_tokens_for_email,
    VerificationError,
)
from utils.verification_codes import issue_verification_code, consume_verification_code
from utils.account_status import sync_account_status
from utils.ratelimit import limiter

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/login", tags=["auth"])
@limiter.limit("10/minute")
async def login(request: Request, background_tasks: BackgroundTasks, payload: dict = Body(...)):
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            user = row(cursor,
                "SELECT u.id, u.email, u.password_hash, p.role, p.status "
                "FROM users u JOIN profiles p ON p.id = u.id WHERE u.email = %s",
                (email,))
    finally:
        try: next(db_gen)
        except StopIteration: pass

    if not user or not pwd_context.verify(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user["status"] == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    if user["status"] == "pending":
        raise HTTPException(status_code=403, detail="Account pending activation")

    token = create_access_token({"id": user["id"], "email": user["email"], "role": user["role"]})

    background_tasks.add_task(
        send_email, user["email"],
        "Nouvelle connexion détectée",
        "Bonjour,\n\nUne nouvelle connexion à votre compte HumatiQ a été détectée.\n\n"
        "Si vous n'êtes pas à l'origine de cette action, changez votre mot de passe immédiatement.\n\nL'équipe HumatiQ"
    )

    return {"access_token": token, "token_type": "bearer", "role": user["role"], "id": user["id"], "email": user["email"]}


@router.post("/register", tags=["auth"])
@limiter.limit("5/minute")
async def register(request: Request, background_tasks: BackgroundTasks, payload: dict = Body(...)):
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")
    first_name = payload.get("first_name", "").strip()
    last_name = payload.get("last_name", "").strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")

    user_id = str(uuid.uuid4())
    password_hash = pwd_context.hash(password)

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, password_hash)
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "candidat", "pending", first_name or None, last_name or None)
            )
        db.commit()
    except pymysql.err.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {e}")
    finally:
        try: next(db_gen)
        except StopIteration: pass

    try:
        mongo_client = connect_mongodb()
        db_mongo = mongo_client["HumatiQ"]
        now = datetime.now(timezone.utc)
        db_mongo.candidates.insert_one({
            "user_id": user_id,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "about": "",
            "skills": [],
            "experiences": [],
            "educations": [],
            "languages": [],
            "phone": "",
            "setup_completed": False,
            "created_at": now,
            "updated_at": now,
        })
    except Exception as e:
        print(f"WARNING: failed to create MongoDB candidate doc for {user_id}: {e}")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            code = issue_verification_code(cursor, email)
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    background_tasks.add_task(
        send_email, email,
        "Vérifiez votre compte HumatiQ",
        f"Bonjour {first_name or ''},\n\nVoici votre code de vérification (valable 15 minutes) :\n\n{code}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nL'équipe HumatiQ"
    )

    return {"email": email, "message": "Verification code sent"}


ALLOWED_ROLES = {"candidat", "hr", "recruiter", "chef_departement", "manager", "admin", "superadmin"}


@router.post("/admin/create-user", tags=["auth"])
async def admin_create_user(
    background_tasks: BackgroundTasks,
    payload: dict = Body(...),
    current_user: dict = Depends(require_roles(["admin", "superadmin"])),
):
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "") or "TempPassword123!"
    first_name = (payload.get("first_name") or "").strip()
    last_name = (payload.get("last_name") or "").strip()
    role = (payload.get("role") or "candidat").strip()
    status = (payload.get("status") or "active").strip()

    if not email:
        raise HTTPException(status_code=400, detail="email required")
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")

    user_id = str(uuid.uuid4())
    password_hash = pwd_context.hash(password)

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, password_hash)
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, role, status, first_name or None, last_name or None)
            )
        db.commit()
    except pymysql.err.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"User creation failed: {e}")
    finally:
        try: next(db_gen)
        except StopIteration: pass

    if status == "pending":
        db_gen = get_db()
        db = next(db_gen)
        try:
            with db.cursor() as cursor:
                token = issue_verification_token(cursor, email)
            db.commit()
        finally:
            try: next(db_gen)
            except StopIteration: pass

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
        verify_link = f"{frontend_url}/hr/verify-email?token={token}"
        background_tasks.add_task(
            send_email, email,
            "Activez votre compte HumatiQ",
            f"Bonjour {first_name or ''},\n\nUn compte administrateur a été créé pour vous sur HumatiQ.\n\n"
            f"Cliquez sur ce lien pour activer votre compte (valable 7 jours) :\n\n{verify_link}\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nL'équipe HumatiQ"
        )

    return {"id": user_id, "email": email, "role": role, "status": status}


@router.post("/verify-account", tags=["auth"])
async def verify_account(payload: dict = Body(...)):
    token = (payload.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token required")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            try:
                email = consume_verification_token(cursor, token)
            except VerificationError as e:
                db.rollback()
                raise HTTPException(status_code=400, detail=str(e))

            user = row(cursor, "SELECT id FROM users WHERE email = %s", (email,))
            if not user:
                db.rollback()
                raise HTTPException(status_code=404, detail="Account not found")

            mongo_client = connect_mongodb()
            mongo_db = mongo_client["HumatiQ"]
            sync_account_status(cursor, mongo_db, user["id"], "active")
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    return {"message": "Account activated successfully"}


@router.post("/admin/resend-verification", tags=["auth"])
async def resend_verification(
    background_tasks: BackgroundTasks,
    payload: dict = Body(...),
    current_user: dict = Depends(require_roles(["admin", "superadmin"])),
):
    user_id = (payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            target = row(cursor,
                "SELECT u.email, p.status FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = %s",
                (user_id,))
            if not target:
                raise HTTPException(status_code=404, detail="User not found")
            if target["status"] != "pending":
                raise HTTPException(status_code=400, detail="User is not pending activation")

            token = issue_verification_token(cursor, target["email"])
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    verify_link = f"{frontend_url}/hr/verify-email?token={token}"
    background_tasks.add_task(
        send_email, target["email"],
        "Activez votre compte HumatiQ",
        f"Bonjour,\n\nVoici un nouveau lien pour activer votre compte HumatiQ (valable 7 jours) :\n\n{verify_link}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nL'équipe HumatiQ"
    )

    return {"message": "Verification email resent"}


@router.post("/admin/force-activate", tags=["auth"])
async def force_activate(
    payload: dict = Body(...),
    current_user: dict = Depends(require_roles(["admin", "superadmin"])),
):
    user_id = (payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            target = row(cursor,
                "SELECT u.email, p.status FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = %s",
                (user_id,))
            if not target:
                raise HTTPException(status_code=404, detail="User not found")
            if target["status"] != "pending":
                raise HTTPException(status_code=400, detail="User is not pending activation")

            invalidate_tokens_for_email(cursor, target["email"])

            mongo_client = connect_mongodb()
            mongo_db = mongo_client["HumatiQ"]
            sync_account_status(cursor, mongo_db, user_id, "active")
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    return {"message": "Account activated"}


@router.post("/resend-verification", tags=["auth"])
async def resend_verification_self_service(background_tasks: BackgroundTasks, payload: dict = Body(...)):
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            target = row(cursor,
                "SELECT p.status FROM users u JOIN profiles p ON p.id = u.id WHERE u.email = %s",
                (email,))
            token = None
            if target and target["status"] == "pending":
                token = issue_verification_token(cursor, email)
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    if token:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
        verify_link = f"{frontend_url}/hr/verify-email?token={token}"
        background_tasks.add_task(
            send_email, email,
            "Activez votre compte HumatiQ",
            f"Bonjour,\n\nVoici un nouveau lien pour activer votre compte HumatiQ (valable 7 jours) :\n\n{verify_link}\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nL'équipe HumatiQ"
        )

    return {"message": "Si ce compte est en attente d'activation, un nouveau lien a été envoyé."}


@router.post("/verify-account-code", tags=["auth"])
@limiter.limit("10/minute")
async def verify_account_code(request: Request, payload: dict = Body(...)):
    email = (payload.get("email") or "").strip().lower()
    code = (payload.get("code") or "").strip()
    if not email or not code:
        raise HTTPException(status_code=400, detail="email and code required")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            try:
                consume_verification_code(cursor, email, code)
            except VerificationError as e:
                db.rollback()
                raise HTTPException(status_code=400, detail=str(e))

            user = row(cursor,
                "SELECT u.id, p.role FROM users u JOIN profiles p ON p.id = u.id WHERE u.email = %s",
                (email,))
            if not user:
                db.rollback()
                raise HTTPException(status_code=404, detail="Account not found")

            mongo_client = connect_mongodb()
            mongo_db = mongo_client["HumatiQ"]
            sync_account_status(cursor, mongo_db, user["id"], "active")
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    token = create_access_token({"id": user["id"], "email": email, "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "role": user["role"], "id": user["id"], "email": email}


@router.post("/resend-verification-code", tags=["auth"])
@limiter.limit("3/minute")
async def resend_verification_code(request: Request, background_tasks: BackgroundTasks, payload: dict = Body(...)):
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            target = row(cursor,
                "SELECT p.status FROM users u JOIN profiles p ON p.id = u.id WHERE u.email = %s",
                (email,))
            code = None
            if target and target["status"] == "pending":
                code = issue_verification_code(cursor, email)
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    if code:
        background_tasks.add_task(
            send_email, email,
            "Vérifiez votre compte HumatiQ",
            f"Bonjour,\n\nVoici votre nouveau code de vérification (valable 15 minutes) :\n\n{code}\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nL'équipe HumatiQ"
        )

    return {"message": "Si ce compte est en attente d'activation, un nouveau code a été envoyé."}


@router.get("/me", tags=["auth"])
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/logout", tags=["auth"])
async def logout():
    return {"message": "Logged out successfully"}


@router.post("/forgot-password", tags=["auth"])
@limiter.limit("5/minute")
async def forgot_password(request: Request, background_tasks: BackgroundTasks, payload: dict = Body(...)):
    email = payload.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            user = row(cursor, "SELECT id FROM users WHERE email = %s", (email,))
    finally:
        try: next(db_gen)
        except StopIteration: pass

    # Always return 200 to avoid email enumeration
    if not user:
        return {"message": "If that email is registered, a reset link has been sent."}

    token = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            # Invalidate existing tokens for this email
            cursor.execute("UPDATE password_resets SET used = 1 WHERE email = %s AND used = 0", (email,))
            cursor.execute(
                "INSERT INTO password_resets (email, token, expires_at) VALUES (%s, %s, %s)",
                (email, token, expires_at.strftime("%Y-%m-%d %H:%M:%S"))
            )
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    reset_link = f"{frontend_url}/candidat/reset-password?token={token}"

    background_tasks.add_task(
        send_email, email,
        "Réinitialisation de votre mot de passe HumatiQ",
        f"Bonjour,\n\nCliquez sur ce lien pour réinitialiser votre mot de passe (valable 1 heure) :\n\n{reset_link}\n\n"
        "Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.\n\nL'équipe HumatiQ"
    )

    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/change-password", tags=["auth"])
async def change_password(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    current_password = payload.get("current_password", "")
    new_password = payload.get("new_password", "")

    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="current_password and new_password required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            user = row(cursor, "SELECT password_hash FROM users WHERE id = %s", (current_user["id"],))
    finally:
        try: next(db_gen)
        except StopIteration: pass

    if not user or not pwd_context.verify(current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    new_hash = pwd_context.hash(new_password)
    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, current_user["id"]))
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    return {"message": "Password changed successfully"}


@router.post("/reset-password", tags=["auth"])
async def reset_password(payload: dict = Body(...)):
    token = payload.get("token", "").strip()
    new_password = payload.get("password", "")

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="token and password required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            reset = row(cursor,
                "SELECT email, expires_at, used FROM password_resets WHERE token = %s",
                (token,))
    finally:
        try: next(db_gen)
        except StopIteration: pass

    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if reset["used"]:
        raise HTTPException(status_code=400, detail="Reset link already used")

    expires_at = reset["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset link has expired")

    password_hash = pwd_context.hash(new_password)
    email = reset["email"]

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            cursor.execute("UPDATE users SET password_hash = %s WHERE email = %s", (password_hash, email))
            cursor.execute("UPDATE password_resets SET used = 1 WHERE token = %s", (token,))
        db.commit()
    finally:
        try: next(db_gen)
        except StopIteration: pass

    return {"message": "Password updated successfully"}
