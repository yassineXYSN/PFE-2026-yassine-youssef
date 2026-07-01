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

