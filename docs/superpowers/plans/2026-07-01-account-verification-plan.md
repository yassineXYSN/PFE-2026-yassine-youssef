# Account Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give SuperAdmin-created HR/admin accounts (and the password-based branch of the HR team-invite flow) a real email-verification gate, replacing the current dead end where accounts are created `pending` with no way to ever become `active`.

**Architecture:** A new `account_verifications` MySQL table (mirrors the existing `password_resets` table) stores single-use, expiring tokens. Two new small utility modules (`backend/utils/verification_tokens.py`, `backend/utils/account_status.py`) centralize token handling and the MySQL/MongoDB status-sync that both creation flows and the new endpoints need. Three new/changed `backend/auth.py` endpoints let a new user consume a token to activate, and let an admin resend or force-activate a pending account. Frontend gets a working token-consuming verify page and two new admin-facing recovery actions.

**Tech Stack:** FastAPI, PyMySQL (MariaDB), PyMongo (MongoDB), React, pytest.

**Full design spec:** `docs/superpowers/specs/2026-07-01-account-verification-design.md`

## Global Constraints

- Verification tokens expire **7 days** after issuance.
- Scope is limited to: the SuperAdmin "Nouvel Utilisateur" panel (`POST /auth/admin/create-user`) and the **password-based branch** of `POST /team/invite`. The passwordless "invited" branch of `team.py` is explicitly out of scope — do not touch it.
- Every place that changes account status must keep MySQL `profiles.status` and the matching MongoDB profile document's `status` field in sync — this is the actual root-cause fix (see spec's "Fixing the status split-brain" section).
- All new user-facing email/UI copy is in French, matching the existing tone in `backend/auth.py` and `backend/routers/team.py`.
- All new SQL uses parameterized queries (`%s` placeholders) — never string-interpolate values into SQL, matching existing code throughout `backend/auth.py`.
- Local dev stack is already running via `docker compose up -d` (containers `nexthire-mariadb`, `nexthire-mongodb`, `pfe-2026-yassine-youssef-backend-1`, `pfe-2026-yassine-youssef-frontend-1`). Backend/frontend containers are built from source (no live-mount), so code changes require a rebuild to be visible in the running app — only needed for the final manual verification task.

---

## Task 1: Database schema — `account_verifications` table

**Files:**
- Modify: `docs/schema.sql`

**Interfaces:**
- Produces: `account_verifications` table with columns `id, email, token, expires_at, used, created_at`, consumed by Task 2's utility functions.

- [ ] **Step 1: Add the table definition**

Append to the end of `docs/schema.sql` (after the existing `password_resets` table, which currently ends the file):

```sql

-- Account activation tokens for admin-created accounts (expire after 7 days)
CREATE TABLE IF NOT EXISTS account_verifications (
    id         CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
    email      VARCHAR(255) NOT NULL,
    token      CHAR(64)     NOT NULL UNIQUE,
    expires_at DATETIME     NOT NULL,
    used       TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_av_token (token),
    INDEX idx_av_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Apply it to the already-running local MariaDB container**

The container's data volume already exists, so `docker-entrypoint-initdb.d` won't re-run `schema.sql` automatically. Re-run the whole (idempotent, `CREATE TABLE IF NOT EXISTS`) file against the live container directly:

Run: `docker exec -i nexthire-mariadb mysql -u root -prootpass nexthire_auth < docs/schema.sql`
Expected: command exits with no output (no errors). `root`/`rootpass` are the local-dev-only credentials defined in `docker-compose.yml`.

- [ ] **Step 3: Verify the table exists**

Run: `docker exec nexthire-mariadb mysql -u root -prootpass nexthire_auth -e "DESCRIBE account_verifications;"`
Expected: a table listing the 6 columns (`id`, `email`, `token`, `expires_at`, `used`, `created_at`).

- [ ] **Step 4: Commit**

```bash
git add docs/schema.sql
git commit -m "Add account_verifications table for admin-created account activation"
```

---

## Task 2: Backend utility modules — token handling and status sync

**Files:**
- Create: `backend/utils/verification_tokens.py`
- Create: `backend/utils/account_status.py`
- Test: `backend/tests/test_account_verification.py`

**Interfaces:**
- Consumes: Task 1's `account_verifications` table; `database.mysql.get_db`; `database.mongodb.connect_mongodb`.
- Produces (for Tasks 3, 4, 5):
  - `verification_tokens.VerificationError(Exception)`
  - `verification_tokens.generate_token() -> str`
  - `verification_tokens.issue_verification_token(cursor, email: str, expires_days: int = 7) -> str`
  - `verification_tokens.consume_verification_token(cursor, token: str) -> str` — raises `VerificationError`
  - `verification_tokens.invalidate_tokens_for_email(cursor, email: str) -> None`
  - `account_status.sync_account_status(mysql_cursor, mongo_db, user_id: str, status: str) -> None`

- [ ] **Step 1: Write `backend/utils/verification_tokens.py`**

```python
import secrets
from datetime import datetime, timedelta, timezone


class VerificationError(Exception):
    """Raised when a verification token is missing, already used, or expired."""


def generate_token() -> str:
    return secrets.token_hex(32)


def issue_verification_token(cursor, email: str, expires_days: int = 7) -> str:
    """
    Invalidates any unused verification tokens for `email`, inserts a fresh
    one valid for `expires_days`, and returns the new token.
    Caller is responsible for committing the connection.
    """
    cursor.execute(
        "UPDATE account_verifications SET used = 1 WHERE email = %s AND used = 0",
        (email,)
    )
    token = generate_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)
    cursor.execute(
        "INSERT INTO account_verifications (email, token, expires_at) VALUES (%s, %s, %s)",
        (email, token, expires_at.strftime("%Y-%m-%d %H:%M:%S"))
    )
    return token


def consume_verification_token(cursor, token: str) -> str:
    """
    Validates `token`, marks it used, and returns the associated email.
    Raises VerificationError with a user-facing message if the token is
    unknown, already used, or expired. Caller is responsible for committing.
    """
    cursor.execute(
        "SELECT email, expires_at, used FROM account_verifications WHERE token = %s",
        (token,)
    )
    record = cursor.fetchone()
    if not record:
        raise VerificationError("Invalid or expired verification link")
    if record["used"]:
        raise VerificationError("Verification link already used")

    expires_at = record["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise VerificationError("Verification link has expired")

    cursor.execute("UPDATE account_verifications SET used = 1 WHERE token = %s", (token,))
    return record["email"]


def invalidate_tokens_for_email(cursor, email: str) -> None:
    cursor.execute(
        "UPDATE account_verifications SET used = 1 WHERE email = %s AND used = 0",
        (email,)
    )
```

- [ ] **Step 2: Write `backend/utils/account_status.py`**

```python
from datetime import datetime, timezone


def sync_account_status(mysql_cursor, mongo_db, user_id: str, status: str) -> None:
    """
    Updates profiles.status in MySQL for `user_id`, then mirrors the same
    status onto whichever MongoDB profile document exists for that _id
    (hr_profiles first, then superadmins as a fallback).
    Caller is responsible for committing the MySQL connection.
    """
    mysql_cursor.execute("UPDATE profiles SET status = %s WHERE id = %s", (status, user_id))

    now = datetime.now(timezone.utc)
    result = mongo_db.hr_profiles.update_one(
        {"_id": user_id},
        {"$set": {"status": status, "updated_at": now}}
    )
    if result.matched_count == 0:
        mongo_db.superadmins.update_one(
            {"_id": user_id},
            {"$set": {"status": status, "updated_at": now}}
        )
```

- [ ] **Step 3: Write the failing tests**

Create `backend/tests/test_account_verification.py`. This requires the local MariaDB + MongoDB containers to be reachable (`docker ps` should show `nexthire-mariadb` and `nexthire-mongodb` healthy):

```python
"""
Account verification token & status-sync — Integration tests.

Run tests:
    cd backend
    python -m pytest tests/test_account_verification.py -v

Requires the local MariaDB + MongoDB containers to be reachable (see
docker-compose.yml) with the account_verifications table applied
(docs/schema.sql).
"""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.mysql import get_db, row
from database.mongodb import connect_mongodb
from utils.verification_tokens import (
    issue_verification_token,
    consume_verification_token,
    invalidate_tokens_for_email,
    VerificationError,
)
from utils.account_status import sync_account_status


def _get_conn():
    gen = get_db()
    conn = next(gen)
    return gen, conn


def _release(gen):
    try:
        next(gen)
    except StopIteration:
        pass


def _cleanup_email(email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM account_verifications WHERE email = %s", (email,))
        conn.commit()
    finally:
        _release(gen)


@pytest.fixture
def test_email():
    email = f"verification-test-{uuid.uuid4().hex}@example.com"
    yield email
    _cleanup_email(email)


def test_issue_then_consume_token_succeeds(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            token = issue_verification_token(cursor, test_email)
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            email = consume_verification_token(cursor, token)
        conn.commit()
    finally:
        _release(gen)

    assert email == test_email


def test_consume_unknown_token_raises(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="Invalid or expired"):
                consume_verification_token(cursor, "not-a-real-token")
    finally:
        _release(gen)


def test_consume_used_token_raises(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            token = issue_verification_token(cursor, test_email)
            consume_verification_token(cursor, token)
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="already used"):
                consume_verification_token(cursor, token)
    finally:
        _release(gen)


def test_consume_expired_token_raises(test_email):
    token = secrets_token = "a" * 64
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            expired_at = datetime.now(timezone.utc) - timedelta(days=1)
            cursor.execute(
                "INSERT INTO account_verifications (email, token, expires_at) VALUES (%s, %s, %s)",
                (test_email, token, expired_at.strftime("%Y-%m-%d %H:%M:%S"))
            )
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="expired"):
                consume_verification_token(cursor, token)
    finally:
        _release(gen)


def test_issuing_new_token_invalidates_previous_unused_token(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            first_token = issue_verification_token(cursor, test_email)
            second_token = issue_verification_token(cursor, test_email)
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="already used"):
                consume_verification_token(cursor, first_token)
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            email = consume_verification_token(cursor, second_token)
        conn.commit()
    finally:
        _release(gen)

    assert email == test_email


def test_invalidate_tokens_for_email_marks_all_unused_as_used(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            token = issue_verification_token(cursor, test_email)
            invalidate_tokens_for_email(cursor, test_email)
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="already used"):
                consume_verification_token(cursor, token)
    finally:
        _release(gen)


# ── sync_account_status ──────────────────────────────────────────────────

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture
def pending_hr_user():
    user_id = str(uuid.uuid4())
    email = f"sync-status-test-{user_id}@example.com"

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, pwd_context.hash("irrelevant"))
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "admin", "pending", "Test", "User")
            )
        conn.commit()
    finally:
        _release(gen)

    mongo_db = connect_mongodb()["HumatiQ"]
    mongo_db.hr_profiles.insert_one({"_id": user_id, "email": email, "status": "pending"})

    yield user_id, email

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        _release(gen)
    mongo_db.hr_profiles.delete_one({"_id": user_id})


def test_sync_account_status_updates_mysql_and_mongo(pending_hr_user):
    user_id, _email = pending_hr_user
    mongo_db = connect_mongodb()["HumatiQ"]

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            sync_account_status(cursor, mongo_db, user_id, "active")
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            mysql_row = row(cursor, "SELECT status FROM profiles WHERE id = %s", (user_id,))
    finally:
        _release(gen)
    assert mysql_row["status"] == "active"

    mongo_doc = mongo_db.hr_profiles.find_one({"_id": user_id})
    assert mongo_doc["status"] == "active"
```

- [ ] **Step 4: Run the tests to verify they fail (module not found)**

Run: `cd backend && python -m pytest tests/test_account_verification.py -v`
Expected: `ModuleNotFoundError: No module named 'utils.verification_tokens'` (or `account_status`) — the modules don't exist yet.

- [ ] **Step 5: Create the modules from steps 1-2 if not already done, then run again**

Run: `cd backend && python -m pytest tests/test_account_verification.py -v`
Expected: `7 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/utils/verification_tokens.py backend/utils/account_status.py backend/tests/test_account_verification.py
git commit -m "Add verification-token and account-status-sync utilities with tests"
```

---

## Task 3: `backend/auth.py` — verify/resend/force-activate endpoints

**Files:**
- Modify: `backend/auth.py`

**Interfaces:**
- Consumes: Task 2's `verification_tokens` and `account_status` functions.
- Produces: `POST /api/auth/verify-account` (public), `POST /api/auth/admin/resend-verification` (admin/superadmin), `POST /api/auth/admin/force-activate` (admin/superadmin), all consumed by Tasks 6-8's frontend.

- [ ] **Step 1: Add imports**

In `backend/auth.py`, after the existing imports (after line 11, `from utils.email_utils import send_email`), add:

```python
import os
from utils.verification_tokens import (
    issue_verification_token,
    consume_verification_token,
    invalidate_tokens_for_email,
    VerificationError,
)
from utils.account_status import sync_account_status
```

- [ ] **Step 2: Send an activation email from `admin_create_user` when the new account is pending**

In `backend/auth.py`, change the `admin_create_user` signature (currently at line 120-124) from:

```python
@router.post("/admin/create-user", tags=["auth"])
async def admin_create_user(
    payload: dict = Body(...),
    current_user: dict = Depends(require_roles(["admin", "superadmin"])),
):
```

to:

```python
@router.post("/admin/create-user", tags=["auth"])
async def admin_create_user(
    background_tasks: BackgroundTasks,
    payload: dict = Body(...),
    current_user: dict = Depends(require_roles(["admin", "superadmin"])),
):
```

Then, right before the final `return {"id": user_id, "email": email, "role": role, "status": status}` line (currently line 163), insert:

```python
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
```

- [ ] **Step 3: Add `POST /verify-account`**

Add this new endpoint anywhere after `admin_create_user` in `backend/auth.py` (e.g. right before the `@router.get("/me", ...)` endpoint):

```python
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
```

- [ ] **Step 4: Add `POST /admin/resend-verification`**

Add right after `verify_account`:

```python
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
```

- [ ] **Step 5: Add `POST /admin/force-activate`**

Add right after `resend_verification`:

```python
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
```

- [ ] **Step 6: Sanity-check the app still imports and registers the new routes**

Run: `cd backend && python -c "from main import app; paths = sorted(r.path for r in app.router.routes if '/verify-account' in r.path or 'resend-verification' in r.path or 'force-activate' in r.path); print(paths)"`
Expected: `['/api/auth/admin/force-activate', '/api/auth/admin/resend-verification', '/api/auth/verify-account']`

- [ ] **Step 7: Write integration tests for the three endpoints**

Create `backend/tests/test_auth_verification_endpoints.py`:

```python
"""
Account verification endpoints — Integration tests.

Run tests:
    cd backend
    python -m pytest tests/test_auth_verification_endpoints.py -v

Requires the local MariaDB + MongoDB containers to be reachable.
"""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from passlib.context import CryptContext

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database.mysql import get_db
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

client = TestClient(app)


def _get_conn():
    gen = get_db()
    conn = next(gen)
    return gen, conn


def _release(gen):
    try:
        next(gen)
    except StopIteration:
        pass


def _create_pending_user():
    user_id = str(uuid.uuid4())
    email = f"auth-endpoint-test-{user_id}@example.com"

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, pwd_context.hash("irrelevant"))
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "admin", "pending", "Test", "User")
            )
        conn.commit()
    finally:
        _release(gen)

    mongo_db = connect_mongodb()["HumatiQ"]
    mongo_db.hr_profiles.insert_one({"_id": user_id, "email": email, "status": "pending"})
    return user_id, email, mongo_db


def _delete_user(user_id, mongo_db):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        _release(gen)
    mongo_db.hr_profiles.delete_one({"_id": user_id})


@pytest.fixture
def pending_user():
    user_id, email, mongo_db = _create_pending_user()
    yield user_id, email
    _delete_user(user_id, mongo_db)


@pytest.fixture
def as_superadmin():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "requester-id", "email": "super@example.com", "role": "superadmin",
        "company_id": None, "department_id": None,
    }
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_recruiter():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "requester-id", "email": "recruiter@example.com", "role": "recruiter",
        "company_id": None, "department_id": None,
    }
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_verify_account_missing_token_returns_400():
    response = client.post("/api/auth/verify-account", json={})
    assert response.status_code == 400


def test_verify_account_unknown_token_returns_400():
    response = client.post("/api/auth/verify-account", json={"token": "not-a-real-token"})
    assert response.status_code == 400
    assert "Invalid or expired" in response.json()["detail"]


def test_verify_account_expired_token_returns_400_and_does_not_activate(pending_user):
    user_id, email = pending_user
    token = "b" * 64
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            expired_at = datetime.now(timezone.utc) - timedelta(days=1)
            cursor.execute(
                "INSERT INTO account_verifications (email, token, expires_at) VALUES (%s, %s, %s)",
                (email, token, expired_at.strftime("%Y-%m-%d %H:%M:%S"))
            )
        conn.commit()
    finally:
        _release(gen)

    response = client.post("/api/auth/verify-account", json={"token": token})
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT status FROM profiles WHERE id = %s", (user_id,))
            mysql_row = cursor.fetchone()
    finally:
        _release(gen)
    assert mysql_row["status"] == "pending"


def test_resend_verification_requires_admin_role(pending_user, as_recruiter):
    user_id, _email = pending_user
    response = client.post("/api/auth/admin/resend-verification", json={"user_id": user_id})
    assert response.status_code == 403


def test_resend_verification_rejects_non_pending_user(as_superadmin):
    user_id, email, mongo_db = _create_pending_user()
    try:
        gen, conn = _get_conn()
        try:
            with conn.cursor() as cursor:
                cursor.execute("UPDATE profiles SET status = 'active' WHERE id = %s", (user_id,))
            conn.commit()
        finally:
            _release(gen)

        response = client.post("/api/auth/admin/resend-verification", json={"user_id": user_id})
        assert response.status_code == 400
    finally:
        _delete_user(user_id, mongo_db)


def test_force_activate_requires_admin_role(pending_user, as_recruiter):
    user_id, _email = pending_user
    response = client.post("/api/auth/admin/force-activate", json={"user_id": user_id})
    assert response.status_code == 403


def test_force_activate_activates_pending_user(pending_user, as_superadmin):
    user_id, _email = pending_user
    response = client.post("/api/auth/admin/force-activate", json={"user_id": user_id})
    assert response.status_code == 200

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT status FROM profiles WHERE id = %s", (user_id,))
            mysql_row = cursor.fetchone()
    finally:
        _release(gen)
    assert mysql_row["status"] == "active"

    mongo_db = connect_mongodb()["HumatiQ"]
    mongo_doc = mongo_db.hr_profiles.find_one({"_id": user_id})
    assert mongo_doc["status"] == "active"
```

- [ ] **Step 8: Run the new tests, and Task 2's tests again, to confirm everything passes**

Run: `cd backend && python -m pytest tests/test_account_verification.py tests/test_auth_verification_endpoints.py -v`
Expected: `15 passed`

- [ ] **Step 9: Commit**

```bash
git add backend/auth.py backend/tests/test_auth_verification_endpoints.py
git commit -m "Add account verification endpoints: verify, resend, force-activate"
```

---

## Task 4: `backend/routers/team.py` — pending status + activation link for password invites

**Files:**
- Modify: `backend/routers/team.py`

**Interfaces:**
- Consumes: Task 2's `issue_verification_token`.

- [ ] **Step 1: Add the import**

At the top of `backend/routers/team.py`, after the existing `from utils.email_utils import send_email` line (line 8), add:

```python
from utils.verification_tokens import issue_verification_token
```

- [ ] **Step 2: Create the account as `pending` instead of `active`, and issue a token**

In the `invite_team_member` function, change this block (currently lines 114-126):

```python
        db_gen = get_mysql_db()
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
```

to:

```python
        db_gen = get_mysql_db()
        db_conn = next(db_gen)
        try:
            with db_conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                    (new_id, email.lower().strip(), password_hash)
                )
                cursor.execute(
                    "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                    (new_id, role, "pending", first_name or None, last_name or None)
                )
                verification_token = issue_verification_token(cursor, email.lower().strip())
            db_conn.commit()
            mariadb_user_id = new_id
            print(f"DEBUG: MariaDB user created: {mariadb_user_id}")
```

- [ ] **Step 3: Store the new profile as `pending` too**

Change this line (currently line 149):

```python
        "status": "active" if mariadb_user_id else "invited",
```

to:

```python
        "status": "pending" if mariadb_user_id else "invited",
```

- [ ] **Step 4: Fold the activation link into the credentials email**

Change this block (currently lines 165-176):

```python
    if temp_password:
        content = (
            f"Bonjour {first_name},\n\n"
            f"{current_user['email']} a créé votre compte sur l'espace de gestion RH de {company.get('name')}.\n\n"
            f"Voici vos identifiants de connexion :\n"
            f"  Email    : {email}\n"
            f"  Mot de passe : {temp_password}\n\n"
            f"Connectez-vous ici : {login_url}\n\n"
            f"Nous vous recommandons de changer votre mot de passe après votre première connexion.\n\n"
            f"Bienvenue dans l'équipe !\n"
            f"L'équipe HumatiQ"
        )
```

to:

```python
    if temp_password:
        verify_link = os.getenv("FRONTEND_URL", "http://localhost:5173") + f"/hr/verify-email?token={verification_token}"
        content = (
            f"Bonjour {first_name},\n\n"
            f"{current_user['email']} a créé votre compte sur l'espace de gestion RH de {company.get('name')}.\n\n"
            f"Voici vos identifiants de connexion :\n"
            f"  Email    : {email}\n"
            f"  Mot de passe : {temp_password}\n\n"
            f"Avant de pouvoir vous connecter, vous devez activer votre compte en cliquant sur ce lien "
            f"(valable 7 jours) :\n\n{verify_link}\n\n"
            f"Nous vous recommandons de changer votre mot de passe après votre première connexion.\n\n"
            f"Bienvenue dans l'équipe !\n"
            f"L'équipe HumatiQ"
        )
```

- [ ] **Step 5: Sanity-check the module still imports cleanly**

Run: `cd backend && python -c "from main import app; print('ok')"`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add backend/routers/team.py
git commit -m "Require email verification for password-based team invites"
```

---

## Task 5: `backend/routers/profiles.py` — fix the MySQL/MongoDB status split-brain

**Files:**
- Modify: `backend/routers/profiles.py`
- Test: `backend/tests/test_profiles_status_sync.py`

**Interfaces:**
- Consumes: `database.mysql.get_db`; existing `update_profile` endpoint.
- Produces: `PUT /api/profiles/{id}` now also writes `status` to MySQL `profiles.status` when the request body includes a `status` field — closes the bug where the SuperAdmin edit UI could only ever change the MongoDB copy.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_profiles_status_sync.py`:

```python
"""
Profile status sync — Integration test.

Verifies that PUT /api/profiles/{id} with a status field updates both
MongoDB (hr_profiles.status) and MySQL (profiles.status) — closing the
split-brain bug where only the Mongo copy was ever updated by this route.

Run tests:
    cd backend
    python -m pytest tests/test_profiles_status_sync.py -v
"""

import os
import sys
import uuid

import pytest
from fastapi.testclient import TestClient
from passlib.context import CryptContext

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database.mysql import get_db
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_conn():
    gen = get_db()
    conn = next(gen)
    return gen, conn


def _release(gen):
    try:
        next(gen)
    except StopIteration:
        pass


@pytest.fixture
def pending_hr_user():
    user_id = str(uuid.uuid4())
    email = f"profile-sync-test-{user_id}@example.com"

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, pwd_context.hash("irrelevant"))
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "admin", "pending", "Test", "User")
            )
        conn.commit()
    finally:
        _release(gen)

    mongo_db = connect_mongodb()["HumatiQ"]
    mongo_db.hr_profiles.insert_one({"_id": user_id, "email": email, "status": "pending"})

    yield user_id

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        _release(gen)
    mongo_db.hr_profiles.delete_one({"_id": user_id})


def test_put_profile_status_syncs_mysql_and_mongo(pending_hr_user):
    user_id = pending_hr_user

    app.dependency_overrides[get_current_user] = lambda: {
        "id": "requester-id", "email": "admin@example.com", "role": "superadmin",
        "company_id": None, "department_id": None,
    }
    try:
        client = TestClient(app)
        response = client.put(f"/api/profiles/{user_id}", json={"status": "active"})
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200

    mongo_db = connect_mongodb()["HumatiQ"]
    mongo_doc = mongo_db.hr_profiles.find_one({"_id": user_id})
    assert mongo_doc["status"] == "active"

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT status FROM profiles WHERE id = %s", (user_id,))
            mysql_row = cursor.fetchone()
    finally:
        _release(gen)
    assert mysql_row["status"] == "active"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && python -m pytest tests/test_profiles_status_sync.py -v`
Expected: `FAILED` — `mysql_row["status"]` is still `"pending"`, since `update_profile` currently only writes to MongoDB.

- [ ] **Step 3: Fix `update_profile` in `backend/routers/profiles.py`**

Change the end of the function (currently lines 184-193) from:

```python
    result = db.hr_profiles.update_one(
        {"_id": profile_id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    updated = db.hr_profiles.find_one({"_id": profile_id})
    return updated
```

to:

```python
    result = db.hr_profiles.update_one(
        {"_id": profile_id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")

    if "status" in update_data:
        from database.mysql import get_db as get_mysql_db
        mysql_gen = get_mysql_db()
        mysql_conn = next(mysql_gen)
        try:
            with mysql_conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE profiles SET status = %s WHERE id = %s",
                    (update_data["status"], profile_id)
                )
            mysql_conn.commit()
        finally:
            try: next(mysql_gen)
            except StopIteration: pass

    updated = db.hr_profiles.find_one({"_id": profile_id})
    return updated
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/test_profiles_status_sync.py -v`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/routers/profiles.py backend/tests/test_profiles_status_sync.py
git commit -m "Sync profile status to MySQL on PUT /profiles/{id}"
```

---

## Task 6: Frontend — repurpose `VerifyEmail.jsx` into the token-consuming page

**Files:**
- Modify: `frontend/src/apps/HR/verify-email/VerifyEmail.jsx`
- Modify: `frontend/src/assets/translations/hr/misc.js`

**Interfaces:**
- Consumes: `POST /api/auth/verify-account` (Task 3).

- [ ] **Step 1: Replace the translation keys**

In `frontend/src/assets/translations/hr/misc.js`, the `en` block currently has (lines 315-327):

```js
    'hr-auth-verify-title':            'Check your inbox',
    'hr-auth-verify-text':             'We sent a 6-digit code to',
    'hr-auth-verify-email-fallback':   'your email address',
    'hr-auth-verify-btn-verify':       'Verify code',
    'hr-auth-verify-btn-verifying':    'Verifying...',
    'hr-auth-verify-btn-resend':       'Resend a new code',
    'hr-auth-verify-btn-resending':    'Sending...',
    'hr-auth-verify-err-empty':        'Please enter the received code.',
    'hr-auth-verify-err-invalid':      'Invalid or expired code. Please try again.',
    'hr-auth-verify-err-rate-limit':   'Please wait before requesting a new code.',
    'hr-auth-verify-err-send':         "Error sending the code.",
    'hr-auth-verify-resend-success':   'A new code has been sent!',
    'hr-auth-verify-digit-label':      'Digit {n} of the code',
```

These keys are used **only** by `VerifyEmail.jsx` (confirmed by search — no other file references them), and they describe an OTP-code flow that was never actually built for this page. Replace the entire block with:

```js
    'hr-verify-missing-title':         'Invalid link',
    'hr-verify-missing-desc':          'This activation link is missing its token. Please use the link from your email, or ask an administrator to resend it.',
    'hr-verify-loading-title':         'Activating your account…',
    'hr-verify-loading-desc':          'Please wait while we confirm your verification link.',
    'hr-verify-success-title':         'Account activated!',
    'hr-verify-success-desc':          'Your account is now active. Redirecting you to the login page…',
    'hr-verify-error-title':           'Activation failed',
    'hr-verify-btn-login':             'Go to login',
    'hr-verify-btn-back':              'Back to login',
```

Then find the matching `fr` block (currently lines 719-731):

```js
    'hr-auth-verify-title':            'Vérifiez votre boîte mail',
    'hr-auth-verify-text':             'Nous avons envoyé un code à 6 chiffres à',
    'hr-auth-verify-email-fallback':   'votre adresse email',
    'hr-auth-verify-btn-verify':       'Vérifier le code',
    'hr-auth-verify-btn-verifying':    'Vérification...',
    'hr-auth-verify-btn-resend':       'Renvoyer un nouveau code',
    'hr-auth-verify-btn-resending':    'Envoi en cours...',
    'hr-auth-verify-err-empty':        'Veuillez saisir le code reçu.',
    'hr-auth-verify-err-invalid':      'Code invalide ou expiré. Veuillez réessayer.',
    'hr-auth-verify-err-rate-limit':   'Veuillez patienter avant de demander un nouveau code.',
    'hr-auth-verify-err-send':         "Erreur lors de l'envoi du code.",
    'hr-auth-verify-resend-success':   'Un nouveau code a été envoyé !',
    'hr-auth-verify-digit-label':      'Chiffre {n} du code',
```

and replace it with:

```js
    'hr-verify-missing-title':         'Lien invalide',
    'hr-verify-missing-desc':          "Ce lien d'activation ne contient pas de jeton. Utilisez le lien reçu par email, ou demandez à un administrateur de vous le renvoyer.",
    'hr-verify-loading-title':         'Activation de votre compte…',
    'hr-verify-loading-desc':          'Veuillez patienter pendant que nous confirmons votre lien de vérification.',
    'hr-verify-success-title':         'Compte activé !',
    'hr-verify-success-desc':          'Votre compte est maintenant actif. Redirection vers la connexion…',
    'hr-verify-error-title':           "Échec de l'activation",
    'hr-verify-btn-login':             'Aller à la connexion',
    'hr-verify-btn-back':              'Retour à la connexion',
```

- [ ] **Step 2: Rewrite `VerifyEmail.jsx`**

Replace the entire contents of `frontend/src/apps/HR/verify-email/VerifyEmail.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../../core/api'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../../../core/useLanguage'
import HRHeader from '../components/HRHeader'
import './VerifyEmail.css'

function VerifyEmail() {
    const { effectiveTheme } = useTheme()
    const { t } = useLanguage()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')

    const [status, setStatus] = useState(token ? 'loading' : 'missing')
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (!token) return

        let cancelled = false
        apiFetch('/auth/verify-account', {
            method: 'POST',
            body: JSON.stringify({ token }),
        })
            .then(() => {
                if (cancelled) return
                setStatus('success')
                setTimeout(() => navigate('/hr/login'), 3000)
            })
            .catch((err) => {
                if (cancelled) return
                setErrorMessage(err.message)
                setStatus('error')
            })

        return () => { cancelled = true }
    }, [token])

    const renderContent = () => {
        if (status === 'missing') {
            return (
                <>
                    <div className="verify-icon">
                        <span className="material-symbols-outlined">link_off</span>
                    </div>
                    <div className="verify-header">
                        <h1 className="verify-title">{t('hr-verify-missing-title')}</h1>
                        <p className="verify-text">{t('hr-verify-missing-desc')}</p>
                    </div>
                </>
            )
        }
        if (status === 'loading') {
            return (
                <>
                    <div className="verify-icon">
                        <span className="material-symbols-outlined">hourglass_top</span>
                    </div>
                    <div className="verify-header">
                        <h1 className="verify-title">{t('hr-verify-loading-title')}</h1>
                        <p className="verify-text">{t('hr-verify-loading-desc')}</p>
                    </div>
                </>
            )
        }
        if (status === 'success') {
            return (
                <>
                    <div className="verify-icon">
                        <span className="material-symbols-outlined">check_circle</span>
                    </div>
                    <div className="verify-header">
                        <h1 className="verify-title">{t('hr-verify-success-title')}</h1>
                        <p className="verify-text">{t('hr-verify-success-desc')}</p>
                    </div>
                    <div className="verify-actions">
                        <button className="verify-submit" onClick={() => navigate('/hr/login')}>
                            {t('hr-verify-btn-login')}
                        </button>
                    </div>
                </>
            )
        }
        return (
            <>
                <div className="verify-icon">
                    <span className="material-symbols-outlined">error</span>
                </div>
                <div className="verify-header">
                    <h1 className="verify-title">{t('hr-verify-error-title')}</h1>
                    <p className="verify-text">{errorMessage}</p>
                </div>
                <div className="verify-actions">
                    <button className="verify-btn-ghost" onClick={() => navigate('/hr/login')}>
                        {t('hr-verify-btn-back')}
                    </button>
                </div>
            </>
        )
    }

    return (
        <div className={`verify-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            <HRHeader />
            <div className="verify-main">
                <div className="verify-card">
                    <div className="verify-card-inner">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VerifyEmail
```

This also fixes a pre-existing, unrelated bug found during diagnosis: the old JSX used class names (`verify-email-page`, `verify-email-card`, etc.) that don't exist in `VerifyEmail.css` at all (the CSS file only defines `.verify-page`, `.verify-card`, etc. — leftover from an abandoned OTP-input design), so the page rendered completely unstyled. The new JSX uses the class names that actually exist in the CSS file.

- [ ] **Step 3: Manually verify the page renders in all four states**

Run: `cd frontend && npm run dev` (or use the already-running dev server)
Visit `http://localhost:5173/hr/verify-email` (no token) — expect the "Invalid link" state.
Visit `http://localhost:5173/hr/verify-email?token=bogus` — expect a brief loading state then "Activation failed" with "Invalid or expired verification link".
Expected: both states render with the styled card layout (yellow accent bar, icon, title, text), not unstyled text.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/apps/HR/verify-email/VerifyEmail.jsx frontend/src/assets/translations/hr/misc.js
git commit -m "Wire VerifyEmail page to the new verify-account endpoint"
```

---

## Task 7: Frontend — SuperAdmin panel resend/force-activate actions

**Files:**
- Modify: `frontend/src/apps/SuperAdmin/users/UsersList.jsx`

**Interfaces:**
- Consumes: `POST /api/auth/admin/resend-verification`, `POST /api/auth/admin/force-activate` (Task 3).

- [ ] **Step 1: Add the two handler functions**

In `frontend/src/apps/SuperAdmin/users/UsersList.jsx`, right after `handleDeleteUser` (ends at line 218), add:

```jsx
    const handleResendVerification = async (user) => {
        setOpenDropdown(null);
        try {
            await apiFetch('/auth/admin/resend-verification', {
                method: 'POST',
                body: JSON.stringify({ user_id: user.id })
            });
            addToast('Email de vérification renvoyé.', 'success');
        } catch (error) {
            addToast('Erreur: ' + error.message, 'error');
        }
    };

    const handleForceActivate = async (user) => {
        setOpenDropdown(null);
        try {
            await apiFetch('/auth/admin/force-activate', {
                method: 'POST',
                body: JSON.stringify({ user_id: user.id })
            });
            addToast('Utilisateur activé avec succès.', 'success');
            fetchData();
        } catch (error) {
            addToast('Erreur: ' + error.message, 'error');
        }
    };
```

- [ ] **Step 2: Add the dropdown items**

In the same file, the dropdown portal currently reads (lines 645-663):

```jsx
                    {openDropdown !== null && selectedUserForDropdown && createPortal(
                        <div
                            ref={dropdownRef}
                            className={`action-dropdown-portal ${effectiveTheme === 'dark' ? 'dark' : ''}`}
                            style={{ top: dropdownPos.top, right: dropdownPos.right }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button className="dropdown-item" onClick={() => openEditModal(selectedUserForDropdown)}>
                                <span className="material-symbols-outlined">edit</span>
                                <span>Modifier</span>
                            </button>
                            <div className="dropdown-divider" />
                            <button className="dropdown-item danger" onClick={() => openDeleteModal(selectedUserForDropdown)}>
                                <span className="material-symbols-outlined">delete</span>
                                <span>Supprimer</span>
                            </button>
                        </div>,
                        document.body
                    )}
```

Change it to:

```jsx
                    {openDropdown !== null && selectedUserForDropdown && createPortal(
                        <div
                            ref={dropdownRef}
                            className={`action-dropdown-portal ${effectiveTheme === 'dark' ? 'dark' : ''}`}
                            style={{ top: dropdownPos.top, right: dropdownPos.right }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button className="dropdown-item" onClick={() => openEditModal(selectedUserForDropdown)}>
                                <span className="material-symbols-outlined">edit</span>
                                <span>Modifier</span>
                            </button>
                            {selectedUserForDropdown.status === 'pending' && (
                                <>
                                    <button className="dropdown-item" onClick={() => handleResendVerification(selectedUserForDropdown)}>
                                        <span className="material-symbols-outlined">forward_to_inbox</span>
                                        <span>Renvoyer l'email de vérification</span>
                                    </button>
                                    <button className="dropdown-item" onClick={() => handleForceActivate(selectedUserForDropdown)}>
                                        <span className="material-symbols-outlined">check_circle</span>
                                        <span>Activer manuellement</span>
                                    </button>
                                </>
                            )}
                            <div className="dropdown-divider" />
                            <button className="dropdown-item danger" onClick={() => openDeleteModal(selectedUserForDropdown)}>
                                <span className="material-symbols-outlined">delete</span>
                                <span>Supprimer</span>
                            </button>
                        </div>,
                        document.body
                    )}
```

- [ ] **Step 3: Manually verify**

With the dev server running, log in as a superadmin, go to Utilisateurs, create a new user (status will be "pending" per the existing hardcoded value), open its action dropdown.
Expected: "Renvoyer l'email de vérification" and "Activer manuellement" appear above "Supprimer" only for that pending user, not for existing active users. Clicking "Activer manuellement" flips its status badge to "Actif" after the list refreshes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/apps/SuperAdmin/users/UsersList.jsx
git commit -m "Add resend-verification and force-activate actions to SuperAdmin users list"
```

---

## Task 8: Frontend — Team Management pending status + actions

**Files:**
- Modify: `frontend/src/apps/HR/settings/team/TeamManagement.jsx`
- Modify: `frontend/src/apps/HR/settings/team/TeamManagement.css`
- Modify: `frontend/src/assets/translations/hr/misc.js`

**Interfaces:**
- Consumes: `POST /api/auth/admin/resend-verification`, `POST /api/auth/admin/force-activate` (Task 3); Task 4's `team.py` change (accounts are now created `pending`, not `active`).

- [ ] **Step 1: Add translation keys**

In `frontend/src/assets/translations/hr/misc.js`, `en` block, right after `'hr-team-status-active': 'Active',` (line 139), add:

```js
    'hr-team-status-pending':          'Pending',
    'hr-team-btn-resend-title':        'Resend verification email',
    'hr-team-btn-activate-title':      'Activate manually',
    'hr-team-resend-error':            'Error resending verification email.',
    'hr-team-activate-error':          'Error activating account.',
```

In the `fr` block, right after `'hr-team-status-active': 'Actif',` (line 543), add:

```js
    'hr-team-status-pending':          'En attente',
    'hr-team-btn-resend-title':        "Renvoyer l'email de vérification",
    'hr-team-btn-activate-title':      'Activer manuellement',
    'hr-team-resend-error':            "Erreur lors du renvoi de l'email de vérification.",
    'hr-team-activate-error':          "Erreur lors de l'activation du compte.",
```

Then update the now-inaccurate hint text. `en` block currently has (line 155):

```js
    'hr-team-pwd-hint':                'If provided, the account will be created immediately and the user can log in with it.',
```

Change to:

```js
    'hr-team-pwd-hint':                'If provided, the account is created immediately, but an activation email is sent — the user must click the link before they can log in.',
```

`fr` block currently has (line 559):

```js
    'hr-team-pwd-hint':                "Si saisi, le compte sera créé immédiatement et l'utilisateur pourra se connecter avec.",
```

Change to:

```js
    'hr-team-pwd-hint':                "Si saisi, le compte est créé immédiatement, mais un email d'activation est envoyé — l'utilisateur devra cliquer sur le lien avant de pouvoir se connecter.",
```

- [ ] **Step 2: Add the CSS for the pending pill and two new icon buttons**

In `frontend/src/apps/HR/settings/team/TeamManagement.css`, right after the `.status-pill.active` rule (line 139), add:

```css
.status-pill.pending { background: #FFF3E0; color: #F57C00; }
```

Right after the `.team-management-page.dark .btn-icon-delete:hover` rule (lines 164-167), add:

```css
.btn-icon-resend {
    background: none;
    border: none;
    cursor: pointer;
    color: #888;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s;
}

.btn-icon-resend:hover {
    background: #E3F2FD;
    color: #1976D2;
}

.team-management-page.dark .btn-icon-resend:hover {
    background: rgba(25, 118, 210, 0.1);
    color: #64B5F6;
}

.btn-icon-activate {
    background: none;
    border: none;
    cursor: pointer;
    color: #888;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s;
}

.btn-icon-activate:hover {
    background: #E8F5E9;
    color: #388E3C;
}

.team-management-page.dark .btn-icon-activate:hover {
    background: rgba(56, 142, 60, 0.1);
    color: #81C784;
}
```

- [ ] **Step 3: Add the handler functions**

In `frontend/src/apps/HR/settings/team/TeamManagement.jsx`, right after `handleMemberDelete` (ends at line 94), add:

```jsx
    const handleResendVerification = async (memberId) => {
        try {
            await apiFetch('/auth/admin/resend-verification', {
                method: 'POST',
                body: JSON.stringify({ user_id: memberId })
            });
            setError('');
            fetchData();
        } catch (err) {
            setError(err.message || t('hr-team-resend-error'));
        }
    };

    const handleForceActivate = async (memberId) => {
        try {
            await apiFetch('/auth/admin/force-activate', {
                method: 'POST',
                body: JSON.stringify({ user_id: memberId })
            });
            setError('');
            fetchData();
        } catch (err) {
            setError(err.message || t('hr-team-activate-error'));
        }
    };
```

- [ ] **Step 4: Update the status pill and actions cell**

The status cell currently reads (lines 177-181):

```jsx
                                <td>
                                    <span className={`status-pill ${member.status}`}>
                                        {member.status === 'invited' ? t('hr-team-status-invited') : t('hr-team-status-active')}
                                    </span>
                                </td>
```

Change to:

```jsx
                                <td>
                                    <span className={`status-pill ${member.status}`}>
                                        {member.status === 'invited'
                                            ? t('hr-team-status-invited')
                                            : member.status === 'pending'
                                                ? t('hr-team-status-pending')
                                                : t('hr-team-status-active')}
                                    </span>
                                </td>
```

The actions cell currently reads (lines 182-192):

```jsx
                                <td className="text-center">
                                    <div className="member-actions">
                                        <button
                                            className="btn-icon-delete"
                                            title={t('hr-team-btn-delete-title')}
                                            onClick={() => handleMemberDelete(member._id, `${member.first_name} ${member.last_name}`)}
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                </td>
```

Change to:

```jsx
                                <td className="text-center">
                                    <div className="member-actions">
                                        {member.status === 'pending' && (
                                            <>
                                                <button
                                                    className="btn-icon-resend"
                                                    title={t('hr-team-btn-resend-title')}
                                                    onClick={() => handleResendVerification(member._id)}
                                                >
                                                    <span className="material-symbols-outlined">forward_to_inbox</span>
                                                </button>
                                                <button
                                                    className="btn-icon-activate"
                                                    title={t('hr-team-btn-activate-title')}
                                                    onClick={() => handleForceActivate(member._id)}
                                                >
                                                    <span className="material-symbols-outlined">check_circle</span>
                                                </button>
                                            </>
                                        )}
                                        <button
                                            className="btn-icon-delete"
                                            title={t('hr-team-btn-delete-title')}
                                            onClick={() => handleMemberDelete(member._id, `${member.first_name} ${member.last_name}`)}
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                </td>
```

- [ ] **Step 5: Manually verify**

With the dev server running, log in as an HR admin, go to Team Management, invite a member with a temporary password.
Expected: the new member shows status "En attente" (not "Actif"), with resend/activate icon buttons visible; clicking "Activer manuellement" flips it to "Actif" and hides those two buttons.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/apps/HR/settings/team/TeamManagement.jsx frontend/src/apps/HR/settings/team/TeamManagement.css frontend/src/assets/translations/hr/misc.js
git commit -m "Show pending status and add resend/activate actions in Team Management"
```

---

## Task 9: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Rebuild and restart the containerized backend and frontend so they pick up the code changes**

Run: `docker compose up --build -d backend frontend`
Expected: both containers report healthy (`docker ps` shows `Up ... (healthy)` for both).

- [ ] **Step 2: Full SuperAdmin-panel cycle**

1. Log in as superadmin at `http://localhost:8080/superadmin/dashboard` (or the appropriate login route).
2. Utilisateurs → Nouvel Utilisateur → create an admin user with a real, reachable email address you control.
3. Confirm the toast says "Utilisateur créé avec succès !" and the new row shows status "En attente".
4. Attempt to log in as that new user at `/hr/login`. Expected: blocked with "Votre compte est en attente d'activation. Contactez votre administrateur."
5. Check the inbox for the "Activez votre compte HumatiQ" email. Click the link.
Expected: lands on `/hr/verify-email`, briefly shows the loading state, then "Compte activé !" and auto-redirects to `/hr/login` after ~3 seconds.
6. Log in again with that user's credentials. Expected: login succeeds.

- [ ] **Step 3: Resend and force-activate paths**

1. Create a second admin user the same way; do not click its email link.
2. In Utilisateurs, open its action dropdown → "Renvoyer l'email de vérification". Confirm a second activation email arrives with a different token.
3. Create a third admin user; instead of using either email, use "Activer manuellement" from the dropdown.
Expected: status flips to "Actif" immediately without needing the email; that user can log in right away.

- [ ] **Step 4: HR team-invite cycle**

1. Log in as an onboarded company admin (role `admin`), go to Team Management → Inviter un membre, fill in a recruiter with a temporary password and a real email you control.
2. Confirm the new row shows "En attente" with resend/activate buttons.
3. Click the emailed activation link, confirm it redirects through the same verify page and activates the account, and that the recruiter can then log in with the temporary password.

- [ ] **Step 5: Run the full backend test suite once more**

Run: `cd backend && python -m pytest tests/test_account_verification.py tests/test_auth_verification_endpoints.py tests/test_profiles_status_sync.py -v`
Expected: all tests pass (`16 passed`).

- [ ] **Step 6: Report back**

Summarize the manual walkthrough results to the user (what worked, any surprises) before merging `dev_feature_2` back into `dev_feature_1`.
