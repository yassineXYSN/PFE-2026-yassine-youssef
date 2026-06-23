import os
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dependencies import get_current_user as _decode_jwt   # pure JWT decode → {id, email, role}
from database.mongodb import connect_mongodb

security = HTTPBearer()


async def get_current_user(token_user: dict = Depends(_decode_jwt)) -> dict:
    """
    FastAPI dependency: decode JWT (via dependencies.py) then enrich with
    MongoDB data (company_id, department_id, superadmin check).
    Returns: {id, email, role, company_id, department_id}
    """
    user_id = token_user["id"]
    email = token_user["email"]
    role = token_user["role"]

    # Enrich from MongoDB
    client = connect_mongodb()
    db = client["HumatiQ"] if client else None
    company_id = None
    department_id = None

    if db is not None:
        # Check superadmins collection first
        superadmin_doc = db.superadmins.find_one({"_id": user_id})
        if superadmin_doc:
            role = "superadmin"
        else:
            profile = db.hr_profiles.find_one({"_id": user_id})
            if profile:
                company_id = profile.get("company_id")
                department_id = profile.get("department_id")
                if profile.get("role") and profile["role"] != role:
                    role = profile["role"]

    return {
        "id": user_id,
        "email": email,
        "role": role,
        "company_id": company_id,
        "department_id": department_id,
    }


def require_roles(allowed_roles: list):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles and current_user["role"] != "superadmin":
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return role_checker
