"""
Candidate signup email verification endpoints — Integration tests.

Run tests:
    cd backend
    python -m pytest tests/test_candidate_verification_endpoints.py -v

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
from database.mysql import get_db, row
from database.mongodb import connect_mongodb
from utils.verification_codes import issue_verification_code

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


def _create_pending_candidate():
    user_id = str(uuid.uuid4())
    email = f"candidate-verify-test-{user_id}@example.com"

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, pwd_context.hash("irrelevant"))
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "candidat", "pending", "Test", "Candidate")
            )
        conn.commit()
    finally:
        _release(gen)

    return user_id, email


def _delete_user(user_id, email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM account_verification_codes WHERE email = %s", (email,))
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        _release(gen)


@pytest.fixture
def pending_candidate():
    user_id, email = _create_pending_candidate()
    yield user_id, email
    _delete_user(user_id, email)


def _status_for(user_id):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            result = row(cursor, "SELECT status FROM profiles WHERE id = %s", (user_id,))
    finally:
        _release(gen)
    return result["status"]


def test_register_creates_pending_candidate_without_access_token():
    email = f"register-test-{uuid.uuid4().hex}@example.com"
    try:
        response = client.post("/api/auth/register", json={
            "email": email,
            "password": "SomeSecurePassword1!",
            "first_name": "Jane",
            "last_name": "Doe",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == email
        assert "access_token" not in data

        gen, conn = _get_conn()
        try:
            with conn.cursor() as cursor:
                user = row(cursor,
                    "SELECT u.id, p.status FROM users u JOIN profiles p ON p.id = u.id WHERE u.email = %s",
                    (email,))
        finally:
            _release(gen)
        assert user["status"] == "pending"

        gen, conn = _get_conn()
        try:
            with conn.cursor() as cursor:
                code_row = row(cursor,
                    "SELECT id FROM account_verification_codes WHERE email = %s AND used = 0",
                    (email,))
        finally:
            _release(gen)
        assert code_row is not None
    finally:
        gen, conn = _get_conn()
        try:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM account_verification_codes WHERE email = %s", (email,))
                cursor.execute("DELETE FROM users WHERE email = %s", (email,))
            conn.commit()
        finally:
            _release(gen)
        connect_mongodb()["HumatiQ"].candidates.delete_many({"email": email})


def test_verify_account_code_missing_fields_returns_400():
    response = client.post("/api/auth/verify-account-code", json={"email": "a@example.com"})
    assert response.status_code == 400


def test_verify_account_code_wrong_code_returns_400(pending_candidate):
    _user_id, email = pending_candidate
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            issue_verification_code(cursor, email)
        conn.commit()
    finally:
        _release(gen)

    response = client.post("/api/auth/verify-account-code", json={"email": email, "code": "000000"})
    assert response.status_code == 400


def test_verify_account_code_activates_account_and_returns_token(pending_candidate):
    user_id, email = pending_candidate
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            code = issue_verification_code(cursor, email)
        conn.commit()
    finally:
        _release(gen)

    response = client.post("/api/auth/verify-account-code", json={"email": email, "code": code})
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["role"] == "candidat"
    assert data["email"] == email

    assert _status_for(user_id) == "active"


def test_resend_verification_code_for_pending_user_issues_new_code(pending_candidate):
    _user_id, email = pending_candidate

    response = client.post("/api/auth/resend-verification-code", json={"email": email})
    assert response.status_code == 200

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            code_row = row(cursor,
                "SELECT id FROM account_verification_codes WHERE email = %s AND used = 0",
                (email,))
    finally:
        _release(gen)
    assert code_row is not None


def test_resend_verification_code_generic_message_for_unknown_email():
    response = client.post("/api/auth/resend-verification-code", json={"email": "no-such-user@example.com"})
    assert response.status_code == 200
    assert "attente d'activation" in response.json()["message"]
