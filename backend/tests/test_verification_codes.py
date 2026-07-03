"""
Account verification code (candidate signup OTP) — Integration tests.

Run tests:
    cd backend
    python -m pytest tests/test_verification_codes.py -v

Requires the local MariaDB container to be reachable (see docker-compose.yml)
with the account_verification_codes table applied (docs/schema.sql).
"""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.mysql import get_db
from utils.verification_codes import (
    issue_verification_code,
    consume_verification_code,
    invalidate_codes_for_email,
    MAX_ATTEMPTS,
)
from utils.verification_tokens import VerificationError


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
            cursor.execute("DELETE FROM account_verification_codes WHERE email = %s", (email,))
        conn.commit()
    finally:
        _release(gen)


@pytest.fixture
def test_email():
    email = f"verification-code-test-{uuid.uuid4().hex}@example.com"
    yield email
    _cleanup_email(email)


def test_issue_then_consume_code_succeeds(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            code = issue_verification_code(cursor, test_email)
        conn.commit()
    finally:
        _release(gen)

    assert len(code) == 6 and code.isdigit()

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            consume_verification_code(cursor, test_email, code)
        conn.commit()
    finally:
        _release(gen)


def test_consume_with_no_active_code_raises(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="No active verification code"):
                consume_verification_code(cursor, test_email, "123456")
    finally:
        _release(gen)


def test_consume_wrong_code_raises_and_increments_attempts(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            code = issue_verification_code(cursor, test_email)
        conn.commit()
    finally:
        _release(gen)

    wrong_code = "000000" if code != "000000" else "111111"

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="Invalid verification code"):
                consume_verification_code(cursor, test_email, wrong_code)
        conn.commit()
    finally:
        _release(gen)

    # The correct code should still work after one wrong attempt.
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            consume_verification_code(cursor, test_email, code)
        conn.commit()
    finally:
        _release(gen)


def test_consume_used_code_raises(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            code = issue_verification_code(cursor, test_email)
            consume_verification_code(cursor, test_email, code)
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="No active verification code"):
                consume_verification_code(cursor, test_email, code)
    finally:
        _release(gen)


def test_consume_expired_code_raises(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            expired_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            cursor.execute(
                "INSERT INTO account_verification_codes (email, code, expires_at) VALUES (%s, %s, %s)",
                (test_email, "123456", expired_at.strftime("%Y-%m-%d %H:%M:%S"))
            )
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="expired"):
                consume_verification_code(cursor, test_email, "123456")
    finally:
        _release(gen)


def test_too_many_attempts_invalidates_code(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            code = issue_verification_code(cursor, test_email)
        conn.commit()
    finally:
        _release(gen)

    wrong_code = "000000" if code != "000000" else "111111"

    for _ in range(MAX_ATTEMPTS):
        gen, conn = _get_conn()
        try:
            with conn.cursor() as cursor:
                with pytest.raises(VerificationError):
                    consume_verification_code(cursor, test_email, wrong_code)
            conn.commit()
        finally:
            _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="Too many failed attempts"):
                consume_verification_code(cursor, test_email, code)
    finally:
        _release(gen)


def test_issuing_new_code_invalidates_previous_unused_code(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            first_code = issue_verification_code(cursor, test_email)
            second_code = issue_verification_code(cursor, test_email)
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="Invalid verification code"):
                consume_verification_code(cursor, test_email, first_code)
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            consume_verification_code(cursor, test_email, second_code)
        conn.commit()
    finally:
        _release(gen)


def test_invalidate_codes_for_email_marks_all_unused_as_used(test_email):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            code = issue_verification_code(cursor, test_email)
            invalidate_codes_for_email(cursor, test_email)
        conn.commit()
    finally:
        _release(gen)

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            with pytest.raises(VerificationError, match="No active verification code"):
                consume_verification_code(cursor, test_email, code)
    finally:
        _release(gen)
