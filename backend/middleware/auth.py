import os
import json
from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from dotenv import load_dotenv

# Load .env
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET") 
# On Supabase, the secret is either custom or the default from API Settings
# If not explicitly set in .env, we can fallback to SUPABASE_KEY? No, it has to be the JWT secret.
# In Supabase, tokens are signed with the project JWT secret.
# For now, let's assume we use the Anon role or we grab the user ID directly from the decoded payload.

# Wait, the user has SUPABASE_KEY in .env, which is the anon key, but we need the JWT Secret to verify signatures locally without calling Supabase.
# Actually, the simplest way is to use supabase.auth.get_user(token).

from database.supabase import get_supabase

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates the Supabase JWT token and returns the user payload.
    It calls Supabase API to verify the token is valid and not expired/revoked.
    """
    token = credentials.credentials
    supabase = get_supabase()
    
    if not supabase:
        print("DEBUG: Supabase client is None")
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        # Verify token by asking Supabase for the user
        print(f"DEBUG: Verifying token with Supabase...")
        response = supabase.auth.get_user(token)
        
        if response.user:
            user_role = response.user.user_metadata.get("role") or response.user.app_metadata.get("role") or "candidat"
            print(f"DEBUG: Auth success for {response.user.email} (Role: {user_role})")
            return {
                "id": response.user.id,
                "email": response.user.email,
                "role": user_role
            }
        else:
            print("DEBUG: Supabase returned no user for token")
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        import traceback
        print(f"DEBUG: Auth error type: {type(e).__name__}")
        print(f"DEBUG: Auth error message: {str(e)}")
        # print(traceback.format_exc()) # Optional: heavy logging
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
