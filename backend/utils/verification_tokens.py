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
