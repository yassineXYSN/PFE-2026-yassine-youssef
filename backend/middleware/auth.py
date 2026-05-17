import os
import json
from fastapi import HTTPException, Security, Request, Depends
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
            
            # Enrichir avec MongoDB
            from database.mongodb import connect_mongodb
            client = connect_mongodb()
            db = client["HumatiQ"] if client else None
            company_id = None
            department_id = None
            if db is not None:
                # Check superadmins collection first
                superadmin_doc = db.superadmins.find_one({"_id": response.user.id})
                if superadmin_doc:
                    user_role = "superadmin"
                    print(f"DEBUG: User {response.user.email} authenticated as superadmin from superadmins collection")
                else:
                    profile = db.hr_profiles.find_one({"_id": response.user.id})

                    # Fallback: Check if there's a pending invitation by email
                    if not profile:
                        profile = db.hr_profiles.find_one({"email": response.user.email.lower().strip()})
                        if profile:
                            print(f"DEBUG: Found pending invitation for {response.user.email}. Linking ID {response.user.id}...")

                            # Store old data
                            profile_data = dict(profile)
                            old_id = profile_data.pop("_id")

                            # Prepare new document with real ID
                            profile_data["_id"] = response.user.id
                            profile_data["status"] = "active"
                            profile_data["updated_at"] = datetime.utcnow()

                            # Atomic swap: Delete old and insert new
                            db.hr_profiles.delete_one({"_id": old_id})
                            db.hr_profiles.insert_one(profile_data)

                            # Set current profile to new one
                            profile = profile_data

                    if profile:
                        company_id = profile.get("company_id")
                        department_id = profile.get("department_id")
                        # Update metadata role if it differs from profile role
                        if profile.get("role") and profile["role"] != user_role:
                            user_role = profile["role"]

            print(f"DEBUG: Auth success for {response.user.email} (Role: {user_role}, Company: {company_id}, Dept: {department_id})")
            return {
                "id": response.user.id,
                "email": response.user.email,
                "role": user_role,
                "company_id": company_id,
                "department_id": department_id
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


def require_roles(allowed_roles: list):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles and current_user["role"] != "superadmin":
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return role_checker
