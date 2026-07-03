import secrets
from datetime import datetime, timedelta, timezone

from utils.verification_tokens import VerificationError

MAX_ATTEMPTS = 5


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def issue_verification_code(cursor, email: str, expires_minutes: int = 15) -> str:
    """
    Invalidates any unused verification codes for `email`, inserts a fresh
    6-digit code valid for `expires_minutes`, and returns the new code.
    Caller is responsible for committing the connection.
    """
    cursor.execute(
        "UPDATE account_verification_codes SET used = 1 WHERE email = %s AND used = 0",
        (email,)
    )
    code = generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    cursor.execute(
        "INSERT INTO account_verification_codes (email, code, expires_at) VALUES (%s, %s, %s)",
        (email, code, expires_at.strftime("%Y-%m-%d %H:%M:%S"))
    )
    return code


def consume_verification_code(cursor, email: str, code: str) -> None:
    """
    Validates `code` against the latest unused code issued for `email`, and
    marks it used. Raises VerificationError with a user-facing message if
    there is no active code, the code is wrong, or it has expired or been
    tried too many times. Caller is responsible for committing.
    """
    cursor.execute(
        "SELECT id, code, expires_at, attempts FROM account_verification_codes "
        "WHERE email = %s AND used = 0 ORDER BY created_at DESC LIMIT 1",
        (email,)
    )
    record = cursor.fetchone()
    if not record:
        raise VerificationError("No active verification code. Please request a new one.")

    if record["attempts"] >= MAX_ATTEMPTS:
        cursor.execute("UPDATE account_verification_codes SET used = 1 WHERE id = %s", (record["id"],))
        raise VerificationError("Too many failed attempts. Please request a new code.")

    expires_at = record["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        cursor.execute("UPDATE account_verification_codes SET used = 1 WHERE id = %s", (record["id"],))
        raise VerificationError("Verification code has expired. Please request a new one.")

    if record["code"] != code:
        cursor.execute(
            "UPDATE account_verification_codes SET attempts = attempts + 1 WHERE id = %s",
            (record["id"],)
        )
        raise VerificationError("Invalid verification code.")

    cursor.execute("UPDATE account_verification_codes SET used = 1 WHERE id = %s", (record["id"],))


def invalidate_codes_for_email(cursor, email: str) -> None:
    cursor.execute(
        "UPDATE account_verification_codes SET used = 1 WHERE email = %s AND used = 0",
        (email,)
    )
