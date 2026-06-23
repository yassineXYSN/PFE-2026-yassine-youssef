from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import List, Optional
from bson import ObjectId
from database.mongodb import connect_mongodb
from database.mysql import get_db
from middleware.auth import get_current_user, require_roles
from models.profile import ProfileBase
from utils.email_utils import send_email
from datetime import datetime
import uuid
import os

router = APIRouter(prefix="/team", tags=["team"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

@router.get("/members", response_model=List[ProfileBase])
async def get_team_members(
    current_user: dict = Depends(get_current_user)
):
    """List all team members for the company of the current admin."""
    if not current_user.get("company_id"):
        raise HTTPException(status_code=400, detail="User not associated with a company")
    
    db = get_db()
    # Find all profiles in the same company
    members = list(db.hr_profiles.find({"company_id": current_user["company_id"]}))
    return members

@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_team_member(
    invite_data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Invite a new team member. 
    Checks if company is onboarded and creates a pending profile.
    """
    db = get_db()
    
    # 1. Check if company is onboarded
    company = db.hr_companies.find_one({"_id": ObjectId(current_user["company_id"])})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # ROLE-BASED BYPASS: SuperAdmin can skip onboarding check
    role = current_user.get("role")
    
    # Check if onboarding is done in company or as fallback in profile preferences
    onboarding_in_company = company.get("onboarding_done", False)
    
    # We fetch profile to check preferences as fallback
    user_profile = db.hr_profiles.find_one({"_id": current_user["id"]})
    onboarding_in_profile = False
    if user_profile and user_profile.get("preferences"):
        onboarding_in_profile = user_profile["preferences"].get("onboarding_done", False)

    is_onboarded = onboarding_in_company or onboarding_in_profile

    if role != "superadmin" and not is_onboarded:
        raise HTTPException(
            status_code=400, 
            detail="Veuillez d'abord terminer la configuration de votre entreprise (Onboarding) avant d'inviter des membres."
        )

    email = invite_data.get("email", "").lower().strip()
    role = invite_data.get("role")
    first_name = invite_data.get("first_name", "")
    last_name = invite_data.get("last_name", "")
    department_id = invite_data.get("department_id")
    temp_password = invite_data.get("temporary_password")

    print(f"DEBUG: Inviting email: {email} to role: {role} (Has Temp Pwd: {bool(temp_password)})")

    if not email or not role:
        raise HTTPException(status_code=400, detail="Email and role are required")

    if role not in ["recruiter", "chef_departement"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'recruiter' or 'chef_departement'")

    # 2. If Dept Head, check department
    if role == "chef_departement":
        if not department_id:
            raise HTTPException(status_code=400, detail="Le département est requis pour un Chef de département.")
        
        dept = db.hr_departments.find_one({"_id": ObjectId(department_id), "company_id": current_user["company_id"]})
        if not dept:
            raise HTTPException(status_code=404, detail="Département non trouvé ou n'appartient pas à votre entreprise.")

    # 3. Check if user already exists (case-insensitive search)
    import re
    existing = db.hr_profiles.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    
    if existing:
        print(f"DEBUG: Found existing user with email {email}: {existing.get('_id')} in company {existing.get('company_id')}")
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà dans l'équipe.")

    # 4. Create MariaDB auth account if password provided
    mariadb_user_id = None
    if temp_password:
        import pymysql.err
        from passlib.context import CryptContext
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        password_hash = pwd_ctx.hash(temp_password)
        new_id = str(uuid.uuid4())

        db_gen = get_db()
        db_conn = next(db_gen)
        try:
            with db_conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                    (new_id, email.lower().strip(), password_hash)
                )
                cursor.execute(
                    "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                    (new_id, role, "active", first_name or None, last_name or None)
                )
            db_conn.commit()
            mariadb_user_id = new_id
            print(f"DEBUG: MariaDB user created: {mariadb_user_id}")
        except pymysql.err.IntegrityError:
            db_conn.rollback()
            raise HTTPException(status_code=400, detail="Ce compte existe déjà. L'email est déjà enregistré.")
        except Exception as e:
            db_conn.rollback()
            raise HTTPException(status_code=500, detail=f"Échec de création du compte d'accès : {e}")
        finally:
            try: next(db_gen)
            except StopIteration: pass

    # 5. Create profile in MongoDB
    # If no password provided, use a temporary ID for the invitation flow
    profile_id = mariadb_user_id if mariadb_user_id else f"invited_{uuid.uuid4().hex}"
    
    new_profile = {
        "_id": profile_id,
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "role": role,
        "company_id": current_user["company_id"],
        "department_id": department_id,
        "status": "active" if mariadb_user_id else "invited",
        "password_must_change": bool(mariadb_user_id),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "preferences": {
            "onboarding_done": True # They are added by admin, so they bypass their own onboarding
        }
    }
    
    db.hr_profiles.insert_one(new_profile)

    # 6. Send invitation email
    subject = f"Vos accès pour rejoindre l'équipe de {company.get('name', 'votre entreprise')} sur HumatiQ"

    login_url = os.getenv("FRONTEND_URL", "http://localhost:5173") + "/hr/login"

    if temp_password:
        content = (
            f"Bonjour {first_name},\n\n"
            f"{current_user['email']} a créé votre compte sur l'espace de gestion RH de {company.get('name')}.\n\n"
            f"Voici vos identifiants de connexion :\n"
            f"  Email    : {email}\n"
            f"  Mot de passe : {temp_password}\n\n"
            f"Connectez-vous ici : {login_url}\n\n"
            f"Nous vous recommandons de changer votre mot de passe après votre première connexion.\n\n"
            f"Bienvenue dans l'équipe !\n"
            f"L'équipe HumatiQ"
        )
    else:
        content = (
            f"Bonjour {first_name},\n\n"
            f"{current_user['email']} vous invite à rejoindre l'espace de gestion RH de {company.get('name')} "
            f"en tant que {role}.\n\n"
            f"Pour activer votre accès, il vous suffit de vous connecter sur la plateforme en utilisant cette adresse email ({email}) :\n"
            f"{login_url}\n\n"
            f"- Si vous n'avez pas encore de compte, cliquez sur 'Connexion sans mot de passe' ou utilisez votre compte Google.\n"
            f"Bienvenue dans l'équipe !\n"
            f"L'équipe HumatiQ"
        )
    
    background_tasks.add_task(send_email, email, subject, content)

    return {"message": "Invitation envoyée avec succès", "profile_id": profile_id}
