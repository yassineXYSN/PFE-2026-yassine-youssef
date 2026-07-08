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
    token = "a" * 64
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
