# Task 4: Audit — Fix Remaining Supabase References

## Context

Phase 1 auth migration. Tasks 1-3 created the MariaDB foundation, rewrote the core auth files,
and updated main.py/requirements.txt. This task removes all remaining Supabase calls from
application code (ignoring venv/).

## Files to Fix

### 1. `backend/database/__init__.py`

Remove the Supabase import line:
```python
# REMOVE this line:
from .supabase import connect_supabase
```
Keep only: `from .mongodb import connect_mongodb`

---

### 2. `backend/utils/email.py`

Update the docstring only — change the default SMTP host reference from Supabase to generic:

```python
# Change default from:
smtp_host = os.getenv("SMTP_HOST", "smtp.supabase.co")
# To:
smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
```

Also update the docstring — remove "Defaults to Supabase SMTP (smtp.supabase.co:587) with STARTTLS."
Replace with: "Defaults to Gmail SMTP (smtp.gmail.com:587) with STARTTLS. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in .env."

---

### 3. `backend/routes/candidat/helpers.py`

Replace the Supabase token verification helpers with JWT decode.

Replace the entire file content:
```python
"""
Shared helpers for candidat routes.
"""
import os
from fastapi import HTTPException
from jose import jwt, JWTError
from dotenv import load_dotenv
from database.mongodb import connect_mongodb

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env'))

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"


def _decode_token(authorization: str) -> dict:
    """Decode and verify the local HS256 JWT, return the payload dict."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("id") or not payload.get("email"):
            raise HTTPException(status_code=401, detail="Invalid token: missing claims")
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")


def get_user_id_from_token(authorization: str) -> str:
    """Verify the JWT and return the user id."""
    return _decode_token(authorization)["id"]


def get_user_info_from_token(authorization: str) -> tuple[str, str]:
    """Verify the JWT and return (user_id, email)."""
    payload = _decode_token(authorization)
    return payload["id"], payload["email"]


def get_user_metadata_from_token(authorization: str) -> dict:
    """Return user metadata from JWT claims (never raises)."""
    try:
        payload = _decode_token(authorization)
        return {"role": payload.get("role"), "id": payload.get("id")}
    except Exception:
        return {}


def get_candidates_collection():
    """Return the MongoDB candidates collection."""
    client = connect_mongodb()
    if client is None:
        raise HTTPException(status_code=500, detail="Could not connect to MongoDB")
    db = client["HumatiQ"]
    return db["candidates"]
```

Note on dotenv path: `helpers.py` is at `backend/routes/candidat/helpers.py`.
`os.path.dirname` × 3 from `__file__` = `backend/`. Then append `.env`.
Verify: `os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))` → the backend dir.

---

### 4. `backend/routes/candidat/settings.py`

Fix the `delete_account` endpoint. Currently it calls `get_supabase_admin()` to delete the Supabase auth user.

**Step A**: Remove the import at the top:
```python
# REMOVE:
from database.supabase import get_supabase_admin
```

**Step B**: Add MariaDB import at top:
```python
from database.mysql import get_db
```

**Step C**: Rewrite the bottom of the `delete_account` endpoint. Replace:
```python
    # Remove the authentication account (service-role required).
    auth_deleted = False
    admin = get_supabase_admin()
    if admin is not None:
        try:
            admin.auth.admin.delete_user(user_id)
            auth_deleted = True
        except Exception as exc:
            print(f"WARNING: failed to delete Supabase auth user {user_id}: {exc}")
    else:
        print("WARNING: Supabase admin client unavailable; auth account not deleted.")

    return {"status": "deleted", "records_deleted": deleted, "auth_account_deleted": auth_deleted}
```

With:
```python
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
```

---

### 5. `backend/routes/candidat/twofa.py`

The Supabase import is inside a try block at line ~71, used as a fallback to get the user's email.

Find the block:
```python
    if not email:
        try:
            from ...database.supabase import get_supabase
            token = authorization.split(" ", 1)[1]
            sb = get_supabase()
            user_response = sb.auth.get_user(token)
            email = user_response.user.email
            if email:
                collection.update_one({"user_id": user_id}, {"$set": {"email": email}}, upsert=True)
        except Exception as e:
            print(f"Error fetching user email from Supabase: {e}")
```

Replace with a JWT-based fallback:
```python
    if not email:
        try:
            from .helpers import get_user_info_from_token
            _, email = get_user_info_from_token(authorization)
            if email:
                collection.update_one({"user_id": user_id}, {"$set": {"email": email}}, upsert=True)
        except Exception as e:
            print(f"Error fetching user email from token: {e}")
```

---

### 6. `backend/routers/team.py`

The invite flow creates a Supabase auth user when `temp_password` is provided. Replace with MariaDB.

**Step A**: Remove the import:
```python
# REMOVE:
from database.supabase import get_supabase_admin
```

**Step B**: Add MariaDB import:
```python
from database.mysql import get_db
```

**Step C**: Replace the "Handle Supabase Account Creation" block (currently steps 4 onward):

Find:
```python
    # 4. Handle Supabase Account Creation if password provided
    supabase_user_id = None
    if temp_password:
        admin_client = get_supabase_admin()
        if not admin_client:
            raise HTTPException(status_code=500, detail="Configuration serveur incomplète : Clé Service Role manquante.")
            
        try:
            # Create user in Supabase Auth via Admin API
            # Note: In python supabase lib, we pass a dict to create_user
            auth_res = admin_client.auth.admin.create_user({
                "email": email,
                "password": temp_password,
                "email_confirm": True,
                "user_metadata": {
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role,
                    "company_id": current_user["company_id"]
                }
            })
            
            if hasattr(auth_res, 'user') and auth_res.user:
                supabase_user_id = auth_res.user.id
                print(f"DEBUG: Supabase user created directly: {supabase_user_id}")
            else:
                print(f"DEBUG: Supabase creation response unexpected: {auth_res}")
                raise Exception("Supabase n'a pas renvoyé d'identifiant utilisateur.")
                
        except Exception as e:
            error_msg = str(e)
            print(f"DEBUG: Supabase direct creation failed: {error_msg}")
            # If user already exists in Supabase Auth, we can't create them with a new password here
            if "already registered" in error_msg.lower() or "already exists" in error_msg.lower():
                raise HTTPException(status_code=400, detail="Ce compte existe déjà dans Supabase. L'Admin ne peut pas redéfinir son mot de passe.")
            else:
                raise HTTPException(status_code=500, detail=f"Échec de création du compte d'accès : {error_msg}")

    # 5. Create profile in MongoDB
    # If no password was provided, we use a temporary ID for the invitation flow
    profile_id = supabase_user_id if supabase_user_id else f"invited_{uuid.uuid4().hex}"
```

Replace with:
```python
    # 4. Create MariaDB auth account if password provided
    mariadb_user_id = None
    if temp_password:
        import pymysql.err
        from passlib.context import CryptContext
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        password_hash = pwd_ctx.hash(temp_password)
        new_id = str(uuid.uuid4())

        db_gen = get_db()
        db_conn = next(db_gen)
        try:
            with db_conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                    (new_id, email.lower().strip(), password_hash)
                )
                cursor.execute(
                    "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                    (new_id, role, "active", first_name or None, last_name or None)
                )
            db_conn.commit()
            mariadb_user_id = new_id
            print(f"DEBUG: MariaDB user created: {mariadb_user_id}")
        except pymysql.err.IntegrityError:
            db_conn.rollback()
            raise HTTPException(status_code=400, detail="Ce compte existe déjà. L'email est déjà enregistré.")
        except Exception as e:
            db_conn.rollback()
            raise HTTPException(status_code=500, detail=f"Échec de création du compte d'accès : {e}")
        finally:
            try: next(db_gen)
            except StopIteration: pass

    # 5. Create profile in MongoDB
    # If no password provided, use a temporary ID for the invitation flow
    profile_id = mariadb_user_id if mariadb_user_id else f"invited_{uuid.uuid4().hex}"
```

Also update the `new_profile` dict: change `"password_must_change": bool(supabase_user_id)` to `"password_must_change": bool(mariadb_user_id)` and `"status": "active" if supabase_user_id else "invited"` to `"status": "active" if mariadb_user_id else "invited"`.

---

### 7. `backend/scripts/create_superadmin.py`

Replace Supabase user creation with MariaDB + passlib.

Replace the entire file:
```python
"""
Create a superadmin account in MariaDB + MongoDB.

Usage (from the backend/ directory):
    python scripts/create_superadmin.py
"""

import os
import sys
import uuid
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from passlib.context import CryptContext
from database.mysql import get_db
from database.mongodb import connect_mongodb

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    print("=== Create Superadmin ===\n")
    first_name = input("First name: ").strip()
    last_name  = input("Last name:  ").strip()
    email      = input("Email:      ").strip().lower()
    password   = input("Password:   ").strip()

    if not all([first_name, last_name, email, password]):
        print("ERROR: All fields are required.")
        sys.exit(1)

    user_id = str(uuid.uuid4())
    password_hash = pwd_context.hash(password)

    # 1. Insert into MariaDB (users + profiles)
    import pymysql.err
    db_gen = get_db()
    db_conn = next(db_gen)
    try:
        with db_conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, password_hash)
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "superadmin", "active", first_name, last_name)
            )
        db_conn.commit()
        print(f"\n[OK] MariaDB user created (id: {user_id})")
    except pymysql.err.IntegrityError:
        db_conn.rollback()
        print("ERROR: Email already exists in MariaDB.")
        sys.exit(1)
    except Exception as e:
        db_conn.rollback()
        print(f"ERROR creating MariaDB user: {e}")
        sys.exit(1)
    finally:
        try: next(db_gen)
        except StopIteration: pass

    # 2. Insert into MongoDB superadmins collection
    client = connect_mongodb()
    if not client:
        print("ERROR: Could not connect to MongoDB.")
        sys.exit(1)

    db = client["HumatiQ"]

    if db.superadmins.find_one({"_id": user_id}):
        print("WARNING: Superadmin document already exists in MongoDB — skipping insert.")
    else:
        now = datetime.utcnow()
        db.superadmins.insert_one({
            "_id": user_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "role": "superadmin",
            "status": "active",
            "phone": None,
            "avatar_url": None,
            "created_at": now,
            "updated_at": now,
        })
        print(f"[OK] MongoDB superadmin document created.")

    print(f"\nSuperadmin '{first_name} {last_name}' ({email}) created successfully.")
    print(f"User ID: {user_id}")


if __name__ == "__main__":
    main()
```

---

### 8. `backend/tests/test_account_setup.py`

This test file creates Supabase tokens for integration testing. Since Supabase is removed, this
test cannot run as-is. Add a prominent skip comment at the top and remove the Supabase import.

Replace lines 1-50 (the Supabase setup block) with:
```python
"""
Integration test for account setup — DISABLED pending migration to local JWT auth.

This test previously used Supabase to create test tokens.
TODO: Rewrite using the new /api/auth/register + /api/auth/login endpoints
to obtain a JWT, then use that token for the account setup assertions.
"""
import pytest
pytest.skip("Supabase auth removed — test needs rewriting for local JWT", allow_module_level=True)
```

Remove everything else in the file (the old test code that imports from supabase).

---

## Acceptance

Run after all changes:
```bash
python -c "import ast; [ast.parse(open(f).read()) for f in [
    'backend/database/__init__.py',
    'backend/utils/email.py',
    'backend/routes/candidat/helpers.py',
    'backend/routes/candidat/settings.py',
    'backend/routes/candidat/twofa.py',
    'backend/routers/team.py',
    'backend/scripts/create_superadmin.py',
    'backend/tests/test_account_setup.py',
]]; print('All syntax OK')"
```

Then verify zero Supabase references remain (excluding venv/ and database/supabase.py itself):
```bash
grep -rn "supabase\|get_supabase\|SUPABASE" backend/ --include="*.py" \
  | grep -v "__pycache__" \
  | grep -v "venv/" \
  | grep -v "database/supabase.py"
```
Expected output: empty (zero matches).

Commit message: "Task 4: Remove all Supabase references from application code"
