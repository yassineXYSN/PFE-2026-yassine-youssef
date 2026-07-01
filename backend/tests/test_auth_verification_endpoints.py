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
