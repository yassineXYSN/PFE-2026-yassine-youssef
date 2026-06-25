import secrets
import uuid
import pymysql.err
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Body, Depends, HTTPException, BackgroundTasks
from passlib.context import CryptContext
from database.mysql import get_db, row
from database.mongodb import connect_mongodb
from dependencies import create_access_token
from middleware.auth import get_current_user, require_roles
from utils.email_utils import send_email

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/login", tags=["auth"])
async def login(background_tasks: BackgroundTasks, payload: dict = Body(...)):
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
async def register(payload: dict = Body(...)):
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
                (user_id, "candidat", "active", first_name or None, last_name or None)
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

    token = create_access_token({"id": user_id, "email": email, "role": "candidat"})
    return {"access_token": token, "token_type": "bearer", "role": "candidat", "id": user_id, "email": email}


ALLOWED_ROLES = {"candidat", "hr", "recruiter", "chef_departement", "manager", "admin", "superadmin"}


@router.post("/admin/create-user", tags=["auth"])
async def admin_create_user(
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

    return {"id": user_id, "email": email, "role": role, "status": status}


@router.get("/me", tags=["auth"])
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/logout", tags=["auth"])
async def logout():
    return {"message": "Logged out successfully"}


@router.post("/forgot-password", tags=["auth"])
async def forgot_password(background_tasks: BackgroundTasks, payload: dict = Body(...)):
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

    import os
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
