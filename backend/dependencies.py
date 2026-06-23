import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

# Load .env from backend/ directory (same directory as this file)
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(dotenv_path)

SECRET_KEY = os.getenv("SECRET_KEY", "changeme")
if not SECRET_KEY or SECRET_KEY == "changeme":
    raise RuntimeError("SECRET_KEY is not configured — set it in .env before running")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))  # default 24h

security = HTTPBearer()


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Create a signed HS256 JWT.
    Payload: copy of `data` + "exp" claim.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    FastAPI dependency: decode + verify the HS256 JWT from the Authorization header.
    Returns dict with at least: id, email, role.
    Raises HTTP 401 on invalid/expired token.
    Does NOT enrich from MongoDB here (that stays in middleware/auth.py).
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("id")
        email: str = payload.get("email")
        role: str = payload.get("role")
        if user_id is None or email is None or role is None:
            raise HTTPException(status_code=401, detail="Invalid token: missing required claims")
        return {"id": user_id, "email": email, "role": role}
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")
