"""
Demo-account owner-gated 2FA — unit + integration tests.

Unit tests (helpers in utils/demo_security.py) run against a hand-rolled fake
Mongo client (see tests/fake_mongo.py) because the real MongoDB dev container
in this sandbox has an incompatible on-disk feature-compatibility version and
could not be reset (see PR/commit notes). MariaDB-backed endpoint tests use
the real local MariaDB container (docker-compose.db.yml) as the existing auth
tests do, with `auth.connect_mongodb` monkeypatched to the same fake Mongo
client so the demo branch can be exercised end-to-end via TestClient.

Run tests:
    cd backend
    venv/Scripts/python -m pytest tests/test_demo_security.py -v
"""

import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.fake_mongo import FakeMongoClient
from utils.demo_security import (
    OWNER_2FA_EMAIL,
    get_demo_profile,
    is_demo_expired,
    device_label_from_ua,
    find_trusted_device,
    issue_demo_code,
    verify_demo_code,
    trust_device_single,
    revoke_device,
    mint_device_id,
    audit,
)


@pytest.fixture
def db():
    return FakeMongoClient()["HumatiQ"]


# ── issue/verify code ────────────────────────────────────────────────────

def test_issue_code_is_six_digits_and_consumable(db):
    code = issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    assert code.isdigit() and len(code) == 6
    assert verify_demo_code(db, "u1", "dev1", code) is True
    assert verify_demo_code(db, "u1", "dev1", code) is False  # one-time


def test_expired_code_rejected(db):
    code = issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    db.demo_access_codes.update_one(
        {"user_id": "u1"},
        {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}},
    )
    assert verify_demo_code(db, "u1", "dev1", code) is False


def test_issue_invalidates_previous(db):
    c1 = issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    c2 = issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    assert verify_demo_code(db, "u1", "dev1", c1) is False
    assert verify_demo_code(db, "u1", "dev1", c2) is True


def test_verify_wrong_code_rejected(db):
    issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    assert verify_demo_code(db, "u1", "dev1", "000000") is False


def test_verify_wrong_device_rejected(db):
    code = issue_demo_code(db, "u1", "dev1", "1.1.1.1", "UA")
    assert verify_demo_code(db, "u1", "dev-other", code) is False


# ── device trust ─────────────────────────────────────────────────────────

def test_trust_device_single_revokes_others(db):
    trust_device_single(db, "u1", "devA", "1.1.1.1", "UA")
    revoked = trust_device_single(db, "u1", "devB", "1.1.1.1", "UA")
    assert "devA" in revoked
    assert find_trusted_device(db, "u1", "devA") is None
    assert find_trusted_device(db, "u1", "devB") is not None


def test_revoke_device(db):
    trust_device_single(db, "u1", "devA", "1.1.1.1", "UA")
    assert revoke_device(db, "devA") is True
    assert find_trusted_device(db, "u1", "devA") is None
    assert revoke_device(db, "does-not-exist") is False


# ── demo expiry ──────────────────────────────────────────────────────────

def test_is_demo_expired():
    assert is_demo_expired({"demo_expires_at": None}) is False
    assert is_demo_expired({"demo_expires_at": datetime.now(timezone.utc) - timedelta(days=1)}) is True
    assert is_demo_expired({"demo_expires_at": datetime.now(timezone.utc) + timedelta(days=1)}) is False


def test_is_demo_expired_handles_naive_datetime():
    naive_past = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    naive_future = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1)
    assert is_demo_expired({"demo_expires_at": naive_past}) is True
    assert is_demo_expired({"demo_expires_at": naive_future}) is False


# ── get_demo_profile ─────────────────────────────────────────────────────

def test_get_demo_profile_returns_none_when_not_demo(db):
    db.hr_profiles.insert_one({"_id": "u1", "is_demo": False})
    assert get_demo_profile(db, "u1") is None


def test_get_demo_profile_returns_none_when_missing(db):
    assert get_demo_profile(db, "no-such-user") is None


def test_get_demo_profile_returns_doc_when_demo(db):
    db.hr_profiles.insert_one({"_id": "u1", "is_demo": True, "email": "demo@example.com"})
    profile = get_demo_profile(db, "u1")
    assert profile is not None
    assert profile["email"] == "demo@example.com"


# ── device_label_from_ua ─────────────────────────────────────────────────

@pytest.mark.parametrize("ua,expected", [
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36", "Chrome on Windows"),
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", "Safari on Mac"),
    ("Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/121.0", "Firefox on Linux"),
    ("", "Unknown device"),
    (None, "Unknown device"),
])
def test_device_label_from_ua(ua, expected):
    assert device_label_from_ua(ua) == expected


# ── owner email config ───────────────────────────────────────────────────

def test_owner_email_defaults_when_env_unset(monkeypatch):
    # Module-level constant is read at import time; just assert the default
    # matches the documented fallback when no override is present in .env.
    assert OWNER_2FA_EMAIL  # non-empty
    if "OWNER_2FA_EMAIL" not in os.environ:
        assert OWNER_2FA_EMAIL == "yassinechtourou03@gmail.com"


def test_audit_writes_event(db):
    audit(db, "u1", "demo@example.com", "gate_challenged", ip="1.1.1.1", user_agent="UA", device_id="dev1")
    rows = list(db.demo_login_audit.find({"user_id": "u1"}))
    assert len(rows) == 1
    assert rows[0]["event"] == "gate_challenged"


# ── B2: /auth/login demo branch + /auth/demo/verify-code (TestClient) ─────
# Requires the local MariaDB container (docker-compose.db.yml) to be
# reachable; Mongo is faked (see module docstring) via monkeypatching
# `auth.connect_mongodb`. Emails are mocked to avoid real SMTP sends.

import uuid as _uuid

from fastapi.testclient import TestClient
from passlib.context import CryptContext as _CryptContext

from main import app
from database.mysql import get_db as _get_mysql_db

_client = TestClient(app)
_pwd_context = _CryptContext(schemes=["bcrypt"], deprecated="auto")
_TEST_PASSWORD = "DemoTest#Pass123"


def _mysql_conn():
    gen = _get_mysql_db()
    conn = next(gen)
    return gen, conn


def _mysql_release(gen):
    try:
        next(gen)
    except StopIteration:
        pass


def _create_mysql_user(role="hr", status="active"):
    user_id = str(_uuid.uuid4())
    email = f"demo2fa-test-{user_id}@example.com"
    gen, conn = _mysql_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, _pwd_context.hash(_TEST_PASSWORD)),
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, role, status, "Demo", "User"),
            )
        conn.commit()
    finally:
        _mysql_release(gen)
    return user_id, email


def _delete_mysql_user(user_id):
    gen, conn = _mysql_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        _mysql_release(gen)


@pytest.fixture
def mysql_user():
    user_id, email = _create_mysql_user()
    yield user_id, email
    _delete_mysql_user(user_id)


@pytest.fixture
def demo_mongo(monkeypatch):
    """Fake Mongo client wired into auth.py's demo branch; mocks outbound email."""
    fake_client = FakeMongoClient()
    monkeypatch.setattr("auth.connect_mongodb", lambda: fake_client)
    monkeypatch.setattr("utils.demo_security.send_email", lambda *a, **k: True)
    monkeypatch.setattr("auth.send_email", lambda *a, **k: True)
    return fake_client["HumatiQ"]


def test_login_demo_no_device_returns_challenge(mysql_user, demo_mongo):
    user_id, email = mysql_user
    demo_mongo.hr_profiles.insert_one({"_id": user_id, "email": email, "is_demo": True})

    resp = _client.post("/api/auth/login", json={"email": email, "password": _TEST_PASSWORD})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("demo_2fa_required") is True
    assert data.get("method") == "owner_email"
    assert data.get("user_id") == user_id
    assert "device_id" in data
    assert "access_token" not in data

    codes = list(demo_mongo.demo_access_codes.find({"user_id": user_id}))
    assert len(codes) == 1


def test_login_demo_trusted_device_returns_token(mysql_user, demo_mongo):
    user_id, email = mysql_user
    demo_mongo.hr_profiles.insert_one({"_id": user_id, "email": email, "is_demo": True})
    trust_device_single(demo_mongo, user_id, "dev-trusted", "1.1.1.1", "UA")

    resp = _client.post(
        "/api/auth/login",
        json={"email": email, "password": _TEST_PASSWORD, "device_id": "dev-trusted"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["id"] == user_id
    assert data.get("demo_2fa_required") is None


def test_login_demo_expired_returns_403(mysql_user, demo_mongo):
    user_id, email = mysql_user
    past = datetime.now(timezone.utc) - timedelta(days=1)
    demo_mongo.hr_profiles.insert_one(
        {"_id": user_id, "email": email, "is_demo": True, "demo_expires_at": past}
    )

    resp = _client.post("/api/auth/login", json={"email": email, "password": _TEST_PASSWORD})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Demo period ended"


def test_login_non_demo_account_is_unchanged(mysql_user, demo_mongo):
    """Regression guard: an account with no demo flag (or no hr_profiles doc
    at all) must still get a normal token straight from /auth/login."""
    user_id, email = mysql_user

    resp = _client.post("/api/auth/login", json={"email": email, "password": _TEST_PASSWORD})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["id"] == user_id
    assert data.get("demo_2fa_required") is None
    assert data.get("twofa_required") is None


def test_verify_code_valid_returns_token_and_trusts_device(mysql_user, demo_mongo):
    user_id, email = mysql_user
    demo_mongo.hr_profiles.insert_one({"_id": user_id, "email": email, "is_demo": True})
    code = issue_demo_code(demo_mongo, user_id, "dev-new", "1.1.1.1", "UA")

    resp = _client.post(
        "/api/auth/demo/verify-code",
        json={"user_id": user_id, "device_id": "dev-new", "code": code},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["id"] == user_id
    assert find_trusted_device(demo_mongo, user_id, "dev-new") is not None


def test_verify_code_invalid_returns_400(mysql_user, demo_mongo):
    user_id, email = mysql_user
    demo_mongo.hr_profiles.insert_one({"_id": user_id, "email": email, "is_demo": True})

    resp = _client.post(
        "/api/auth/demo/verify-code",
        json={"user_id": user_id, "device_id": "dev-new", "code": "000000"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid or expired code"


def test_mint_device_id_is_unique():
    a = mint_device_id()
    b = mint_device_id()
    assert a != b
    assert len(a) > 20


# ── B3: SuperAdmin audit/devices/revoke endpoints ──────────────────────────

from middleware.auth import get_current_user as _get_current_user


@pytest.fixture
def as_superadmin():
    app.dependency_overrides[_get_current_user] = lambda: {
        "id": "requester-id", "email": "super@example.com", "role": "superadmin",
        "company_id": None, "department_id": None,
    }
    yield
    app.dependency_overrides.pop(_get_current_user, None)


@pytest.fixture
def as_hr():
    app.dependency_overrides[_get_current_user] = lambda: {
        "id": "requester-id", "email": "hr@example.com", "role": "hr",
        "company_id": None, "department_id": None,
    }
    yield
    app.dependency_overrides.pop(_get_current_user, None)


def test_demo_devices_lists_trusted_device_with_email(demo_mongo, as_superadmin):
    demo_mongo.hr_profiles.insert_one({"_id": "u1", "email": "demo@example.com", "is_demo": True})
    trust_device_single(demo_mongo, "u1", "devA", "1.1.1.1", "UA")

    resp = _client.get("/api/auth/demo/devices")
    assert resp.status_code == 200
    devices = resp.json()
    assert len(devices) == 1
    assert devices[0]["device_id"] == "devA"
    assert devices[0]["email"] == "demo@example.com"


def test_demo_audit_returns_rows_newest_first(demo_mongo, as_superadmin):
    audit(demo_mongo, "u1", "demo@example.com", "gate_challenged")
    audit(demo_mongo, "u1", "demo@example.com", "code_verified")

    resp = _client.get("/api/auth/demo/audit", params={"user_id": "u1"})
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 2
    assert rows[0]["event"] == "code_verified"  # newest first


def test_demo_revoke_device_flips_revoked(demo_mongo, as_superadmin):
    trust_device_single(demo_mongo, "u1", "devA", "1.1.1.1", "UA")

    resp = _client.post("/api/auth/demo/revoke-device", json={"device_id": "devA"})
    assert resp.status_code == 200
    assert resp.json() == {"message": "revoked"}
    assert find_trusted_device(demo_mongo, "u1", "devA") is None


def test_demo_devices_requires_superadmin(demo_mongo, as_hr):
    resp = _client.get("/api/auth/demo/devices")
    assert resp.status_code == 403


def test_demo_revoke_device_requires_superadmin(demo_mongo, as_hr):
    resp = _client.post("/api/auth/demo/revoke-device", json={"device_id": "devA"})
    assert resp.status_code == 403
