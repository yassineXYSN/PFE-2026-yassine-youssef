# Task 2: Rewrite Auth Layer — middleware/auth.py + auth.py

## Context

Phase 1 auth migration. Task 1 created `backend/dependencies.py` (JWT helpers) and
`backend/database/mysql.py` (PyMySQL helpers). This task rewrites the two auth files
to use local JWT + MariaDB instead of Supabase.

**Do NOT modify any other files in this task.**

## File 1: Rewrite `backend/middleware/auth.py`

The current file calls `supabase.auth.get_user(token)` to verify tokens. Replace that
with decoding the local HS256 JWT and enriching from MongoDB.

### New implementation

```python
import os
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dependencies import get_current_user as _decode_jwt   # pure JWT decode → {id, email, role}
from database.mongodb import connect_mongodb

security = HTTPBearer()


async def get_current_user(token_user: dict = Depends(_decode_jwt)) -> dict:
    """
    FastAPI dependency: decode JWT (via dependencies.py) then enrich with
    MongoDB data (company_id, department_id, superadmin check).
    Returns: {id, email, role, company_id, department_id}
    """
    user_id = token_user["id"]
    email = token_user["email"]
    role = token_user["role"]

    # Enrich from MongoDB
    client = connect_mongodb()
    db = client["HumatiQ"] if client else None
    company_id = None
    department_id = None

    if db is not None:
        # Check superadmins collection first
        superadmin_doc = db.superadmins.find_one({"_id": user_id})
        if superadmin_doc:
            role = "superadmin"
        else:
            profile = db.hr_profiles.find_one({"_id": user_id})
            if profile:
                company_id = profile.get("company_id")
                department_id = profile.get("department_id")
                if profile.get("role") and profile["role"] != role:
                    role = profile["role"]

    return {
        "id": user_id,
        "email": email,
        "role": role,
        "company_id": company_id,
        "department_id": department_id,
    }


def require_roles(allowed_roles: list):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles and current_user["role"] != "superadmin":
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return role_checker
```

Key changes vs. current file:
- Remove all imports from `database.supabase`
- Remove SUPABASE_JWT_SECRET, decode_jwt_local, all retry logic
- Remove the "pending invitation linking" logic (Supabase-specific, not needed with stable MariaDB IDs)
- Remove `import time`, `import json`, `import anyio`
- Keep superadmin and hr_profiles Mongo enrichment, keyed on `user_id` (JWT `id` claim = MariaDB UUID)
- Keep `require_roles()`

## File 2: Rewrite `backend/auth.py`

The current file has: `verify-provider` (Supabase OAuth logic), `notify-login` (calls supabase to get user).
Replace with: `login`, `register`, `me`, `logout`.

### New implementation

```python
import os
from datetime import timedelta
from fastapi import APIRouter, Body, Depends, HTTPException, BackgroundTasks
from passlib.context import CryptContext
from database.mysql import get_db
from dependencies import create_access_token, get_current_user
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
        f"Bonjour,\n\nUne nouvelle connexion à votre compte HumatiQ a été détectée.\n\n"
        f"Si vous n'êtes pas à l'origine de cette action, changez votre mot de passe immédiatement.\n\nL'équipe HumatiQ"
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

    import uuid
    user_id = str(uuid.uuid4())
    password_hash = pwd_context.hash(password)

    db_gen = get_db()
    db = next(db_gen)
    try:
        with db.cursor() as cursor:
            # Check for existing user
            existing = row(cursor, "SELECT id FROM users WHERE email = %s", (email,))
            if existing:
                raise HTTPException(status_code=409, detail="Email already registered")
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, password_hash)
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "candidat", "active", first_name or None, last_name or None)
            )
        db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {e}")
    finally:
        try: next(db_gen)
        except StopIteration: pass

    token = create_access_token({"id": user_id, "email": email, "role": "candidat"})
    return {"access_token": token, "token_type": "bearer", "role": "candidat"}


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
```

Import `row` from `database.mysql` (it's the helper created in Task 1).

Key changes vs current file:
- Delete `_unlink_identity`, `_find_other_users_by_email`, `_original_provider_from_raw`
- Delete `verify-provider` endpoint (Supabase-specific OAuth logic)
- Delete `login_info` endpoint (placeholder, replaced by real login)
- Delete `notify-login` endpoint (replaced by background task in /login)
- Remove all imports: `httpx`, `from database.supabase import ...`
- Add `pymysql`, `passlib`, `uuid`, `get_db`, `create_access_token`, `row`

## Constraints

- `passlib[bcrypt]` is already in requirements.txt (`passlib` is listed, bcrypt extra is available since `bcrypt` is also listed separately)
- Do NOT add new imports beyond what's specified
- `get_current_user` in `middleware/auth.py` must be importable by routers that currently use `from middleware.auth import get_current_user` — keep that name
- The `row` helper in `database/mysql.py` takes `(cursor, query, params)` — use it exactly like that
- Since `get_db` is a generator (FastAPI Depends), calling it directly outside a FastAPI route requires `next(gen)` + cleanup pattern as shown. Use this pattern.

## Acceptance

- `backend/middleware/auth.py` no longer imports from `database.supabase`
- `backend/auth.py` no longer imports from `database.supabase`
- `get_current_user` in `middleware/auth.py` returns `{id, email, role, company_id, department_id}`
- `require_roles()` still works the same way
- `/login`, `/register`, `/me`, `/logout` endpoints exist in `auth.py`
- No Supabase imports anywhere in either file

## Note

Do not run tests — the MariaDB is not running locally. Just verify the files parse cleanly with `python -c "import ast; ast.parse(open('file.py').read()); print('OK')"` and commit.
