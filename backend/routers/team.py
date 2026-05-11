from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import List, Optional
from bson import ObjectId
from database.mongodb import connect_mongodb
from database.supabase import get_supabase_admin
from middleware.auth import get_current_user, require_roles
from models.profile import ProfileBase
from utils.email_utils import send_email
from datetime import datetime
import uuid

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

    # 4. Handle Supabase Account Creation if password provided
    supabase_user_id = None
    if temp_password:
        admin_client = get_supabase_admin()
        if not admin_client:
            raise HTTPException(status_code=500, detail="Configuration serveur incomplète : Clé Service Role manquante.")
            
        try:
            # Create user in Supabase Auth via Admin API
            # Note: In python supabase lib, we pass a dict to create_user
            auth_res = admin_client.auth.admin.create_user({
                "email": email,
                "password": temp_password,
                "email_confirm": True,
                "user_metadata": {
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role,
                    "company_id": current_user["company_id"]
                }
            })
            
            if hasattr(auth_res, 'user') and auth_res.user:
                supabase_user_id = auth_res.user.id
                print(f"DEBUG: Supabase user created directly: {supabase_user_id}")
            else:
                print(f"DEBUG: Supabase creation response unexpected: {auth_res}")
                raise Exception("Supabase n'a pas renvoyé d'identifiant utilisateur.")
                
        except Exception as e:
            error_msg = str(e)
            print(f"DEBUG: Supabase direct creation failed: {error_msg}")
            # If user already exists in Supabase Auth, we can't create them with a new password here
            if "already registered" in error_msg.lower() or "already exists" in error_msg.lower():
                raise HTTPException(status_code=400, detail="Ce compte existe déjà dans Supabase. L'Admin ne peut pas redéfinir son mot de passe.")
            else:
                raise HTTPException(status_code=500, detail=f"Échec de création du compte d'accès : {error_msg}")

    # 5. Create profile in MongoDB
    # If no password was provided, we use a temporary ID for the invitation flow
    profile_id = supabase_user_id if supabase_user_id else f"invited_{uuid.uuid4().hex}"
    
    new_profile = {
        "_id": profile_id,
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "role": role,
        "company_id": current_user["company_id"],
        "department_id": department_id,
        "status": "active" if supabase_user_id else "invited",
        "password_must_change": bool(supabase_user_id),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "preferences": {
            "onboarding_done": True # They are added by admin, so they bypass their own onboarding
        }
    }
    
    db.hr_profiles.insert_one(new_profile)

    # 6. Send invitation email
    subject = f"Vos accès pour rejoindre l'équipe de {company.get('name', 'votre entreprise')} sur HumatiQ"

    login_url = "http://localhost:3000/hr/login"

    if temp_password:
        # Generate a one-time password-reset link so we never send the plaintext
        # password over email. The link lets the user set their own password.
        password_setup_link = login_url
        try:
            admin_client = get_supabase_admin()
            if admin_client:
                link_res = admin_client.auth.admin.generate_link({
                    "type": "recovery",
                    "email": email,
                    "options": {"redirect_to": login_url},
                })
                if hasattr(link_res, "properties") and hasattr(link_res.properties, "action_link"):
                    password_setup_link = link_res.properties.action_link
        except Exception as link_err:
            print(f"DEBUG: Could not generate recovery link: {link_err}")

        content = (
            f"Bonjour {first_name},\n\n"
            f"{current_user['email']} a créé votre compte sur l'espace de gestion RH de {company.get('name')}.\n\n"
            f"Pour définir votre mot de passe et accéder à votre compte, cliquez sur le lien sécurisé ci-dessous :\n"
            f"{password_setup_link}\n\n"
            f"Ce lien est à usage unique et expire sous peu. Après avoir défini votre mot de passe, "
            f"vous pourrez vous connecter ici :\n"
            f"{login_url}\n\n"
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
