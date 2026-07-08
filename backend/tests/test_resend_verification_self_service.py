"""
Self-service resend-verification endpoint — Integration tests.

Run tests:
    cd backend
    python -m pytest tests/test_resend_verification_self_service.py -v

Requires the local MariaDB + MongoDB containers to be reachable.
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


def _create_user(status: str):
    user_id = str(uuid.uuid4())
    email = f"resend-self-{user_id}@example.com"

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, pwd_context.hash("irrelevant"))
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "admin", status, "Test", "User")
            )
        conn.commit()
    finally:
        _release(gen)

    return user_id, email


def _delete_user(user_id, email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM account_verifications WHERE email = %s", (email,))
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        _release(gen)


def _unused_token_count(email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) AS c FROM account_verifications WHERE email = %s AND used = 0",
                (email,)
            )
            return cursor.fetchone()["c"]
    finally:
        _release(gen)


@pytest.fixture
def pending_user():
    user_id, email = _create_user("pending")
    yield user_id, email
    _delete_user(user_id, email)


@pytest.fixture
def active_user():
    user_id, email = _create_user("active")
    yield user_id, email
    _delete_user(user_id, email)


EXPECTED_MESSAGE = "Si ce compte est en attente d'activation, un nouveau lien a été envoyé."


def test_resend_missing_email_returns_400():
    response = client.post("/api/auth/resend-verification", json={})
    assert response.status_code == 400


def test_resend_for_pending_user_issues_token_and_returns_generic_message(pending_user):
    _user_id, email = pending_user

    response = client.post("/api/auth/resend-verification", json={"email": email})

    assert response.status_code == 200
    assert response.json()["message"] == EXPECTED_MESSAGE
    assert _unused_token_count(email) == 1


def test_resend_for_unknown_email_returns_same_generic_message():
    response = client.post(
        "/api/auth/resend-verification",
        json={"email": f"no-such-user-{uuid.uuid4().hex}@example.com"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == EXPECTED_MESSAGE


def test_resend_for_active_user_returns_same_generic_message_and_issues_no_token(active_user):
    _user_id, email = active_user

    response = client.post("/api/auth/resend-verification", json={"email": email})

    assert response.status_code == 200
    assert response.json()["message"] == EXPECTED_MESSAGE
    assert _unused_token_count(email) == 0
