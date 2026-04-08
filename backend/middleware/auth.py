import os
import json
from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from dotenv import load_dotenv
import time

# Load .env
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET") 

from database.supabase import get_supabase

security = HTTPBearer()

def decode_jwt_local(token: str):
    """
    Decode JWT locally to inspect claims without hitting Supabase.
    Returns decoded payload or None if invalid.
    """
    try:
        # Decode without verification first to see the claims
        decoded = jwt.get_unverified_claims(token)
        return decoded
    except Exception as e:
        print(f"DEBUG: Failed to decode JWT: {e}")
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates the Supabase JWT token and returns the user payload.
    It calls Supabase API to verify the token is valid and not expired/revoked.
    """
    token = credentials.credentials
    supabase = get_supabase()
    
    if not supabase:
        print("DEBUG: Supabase client is None")
        raise HTTPException(status_code=500, detail="Supabase not configured")

    # Decode and inspect JWT locally first
    jwt_claims = decode_jwt_local(token)
    if jwt_claims:
        exp = jwt_claims.get("exp")
        session_id = jwt_claims.get("session_id")
        sub = jwt_claims.get("sub")
        iat = jwt_claims.get("iat")
        current_time = time.time()
        
        print(f"DEBUG: JWT Claims - sub: {sub}, session_id: {session_id}")
        print(f"DEBUG: JWT Expiry - iat: {iat} ({time.ctime(iat) if iat else 'N/A'}), exp: {exp} ({time.ctime(exp) if exp else 'N/A'}), now: {current_time} ({time.ctime(current_time)})")
        
        if exp and current_time > exp:
            print(f"DEBUG: Token is EXPIRED (exp: {exp}, now: {current_time}, diff: {current_time - exp}s)")
            raise HTTPException(status_code=401, detail="Token expired")
        elif exp:
            remaining = exp - current_time
            print(f"DEBUG: Token valid, expires in {remaining:.1f}s")

    try:
        # Verify token by asking Supabase for the user with retry logic for socket/connection errors
        import anyio
        max_retries = 4
        base_delay = 0.5
        
        for attempt in range(max_retries):
            try:
                print(f"DEBUG: Verifying token with Supabase (Attempt {attempt + 1}/{max_retries})...")
                # Wrap the blocking Supabase call in a thread pool to avoid WinError 10035
                response = await anyio.to_thread.run_sync(lambda: supabase.auth.get_user(token))
                break
            except Exception as e:
                error_name = type(e).__name__
                error_str = str(e)
                
                # Check if this is a retryable socket/network error
                is_retryable = (
                    "WinError 10035" in error_str or
                    "WinError" in error_str or
                    "ReadError" in error_name or
                    "ConnectError" in error_name or
                    "TimeoutError" in error_name or
                    "ConnectionError" in error_name or
                    "Server disconnected" in error_str or
                    "Timeout" in error_str
                )
                
                if is_retryable and attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    print(f"DEBUG: Transient socket error ({error_name}), retrying in {delay}s. Error: {error_str}")
                    await anyio.sleep(delay)
                    continue
                else:
                    # Either non-retryable or final attempt
                    if attempt == max_retries - 1:
                        print(f"DEBUG: Max retries ({max_retries}) exceeded after transient error: {error_str}")
                    raise e
        
        if response.user:
            user_role = response.user.user_metadata.get("role") or response.user.app_metadata.get("role") or "candidat"
            if user_role == "candidate":
                user_role = "candidat"
            print(f"DEBUG: Auth success for {response.user.email} (Role: {user_role})")
            return {
                "id": response.user.id,
                "email": response.user.email,
                "role": user_role
            }
        else:
            print("DEBUG: Supabase returned no user for token")
            raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        error_name = type(e).__name__
        error_str = str(e)
        print(f"DEBUG: Auth error type: {error_name}")
        print(f"DEBUG: Auth error message: {error_str}")
        
        # Special handling for session errors
        if "Session" in error_str or "session_id" in error_str:
            print(f"DEBUG: Session validation failed - token session_id may be invalid or revoked")
        
        raise HTTPException(status_code=401, detail=f"Authentication failed: {error_str}")
