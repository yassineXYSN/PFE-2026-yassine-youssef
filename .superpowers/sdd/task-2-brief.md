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

