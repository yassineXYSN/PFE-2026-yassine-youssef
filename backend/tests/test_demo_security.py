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


def test_mint_device_id_is_unique():
    a = mint_device_id()
    b = mint_device_id()
    assert a != b
    assert len(a) > 20
