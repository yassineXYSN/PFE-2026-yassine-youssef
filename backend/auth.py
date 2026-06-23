import uuid
import pymysql.err
from datetime import datetime, timezone
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
    """
    Email + password login against MariaDB.
    Returns JWT on success.
    """
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")

    # Use get_db as a context manager (not FastAPI Depends here since we call directly)
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

    token = create_access_token({"id": user["id"], "email": user["email"], "role": user["role"]})

    # Send login notification email in background
    background_tasks.add_task(
        send_email, user["email"],
        "Nouvelle connexion détectée",
        "Bonjour,\n\nUne nouvelle connexion à votre compte HumatiQ a été détectée.\n\n"
        "Si vous n'êtes pas à l'origine de cette action, changez votre mot de passe immédiatement.\n\nL'équipe HumatiQ"
    )

    return {"access_token": token, "token_type": "bearer", "role": user["role"]}


@router.post("/register", tags=["auth"])
async def register(payload: dict = Body(...)):
    """
    Register a new user (candidat role by default).
    Returns JWT on success.
    """
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

    # Create the matching candidate document in MongoDB
    try:
        mongo_client = connect_mongodb()
        db = mongo_client["HumatiQ"]
        now = datetime.now(timezone.utc)
        db.candidates.insert_one({
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
        # Non-fatal: auth succeeded, profile can be created later
        print(f"WARNING: failed to create MongoDB candidate doc for {user_id}: {e}")

    token = create_access_token({"id": user_id, "email": email, "role": "candidat"})
    return {"access_token": token, "token_type": "bearer", "role": "candidat"}


ALLOWED_ROLES = {"candidat", "hr", "recruiter", "chef_departement", "manager", "admin", "superadmin"}


@router.post("/admin/create-user", tags=["auth"])
async def admin_create_user(
    payload: dict = Body(...),
    current_user: dict = Depends(require_roles(["admin", "superadmin"])),
):
    """
    Create a new user identity in MariaDB with an explicit role
    (used by the SuperAdmin to create HR / admin accounts).

    Replaces the old Supabase `auth.admin.create_user` flow. Does NOT
    issue a token to the caller — the caller's own session is untouched.
    Returns the new user's id so the frontend can create the matching
    MongoDB profile document.
    """
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "") or "TempPassword123!"
    first_name = (payload.get("first_name") or "").strip()
    last_name = (payload.get("last_name") or "").strip()
    role = (payload.get("role") or "candidat").strip()
    status = (payload.get("status") or "pending").strip()

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
    """Return the current authenticated user's info."""
    return current_user


@router.post("/logout", tags=["auth"])
async def logout():
    """
    JWT is stateless — no server-side session to invalidate.
    Client must discard the token.
    """
    return {"message": "Logged out successfully"}
