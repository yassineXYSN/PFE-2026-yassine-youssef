from fastapi import APIRouter, Header, HTTPException, BackgroundTasks
from typing import Optional
from utils.email_utils import send_email
from database.supabase import get_supabase

router = APIRouter()

@router.get("/login", tags=["auth"])
async def login_info():
    """
    Placeholder login endpoint.
    The actual login is handled by the frontend directly with Supabase.
    """
    return {"message": "HumatiQ login system (Client-side)"}

@router.post("/notify-login", tags=["auth"])
async def notify_login(background_tasks: BackgroundTasks, authorization: Optional[str] = Header(None)):
    """
    Endpoint called by the frontend after a successful login to send a notification email.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ", 1)[1]
    sb = get_supabase()
    
    try:
        user_response = sb.auth.get_user(token)
        user = user_response.user
        if not user or not user.email:
            raise HTTPException(status_code=400, detail="User email not found")

        subject = "Nouvelle connexion détectée"
        content = f"Bonjour,\n\nUne nouvelle connexion à votre compte HumatiQ a été détectée.\n\nSi vous n'êtes pas à l'origine de cette action, nous vous recommandons de changer votre mot de passe immédiatement.\n\nL'équipe HumatiQ"
        
        background_tasks.add_task(send_email, user.email, subject, content)
        return {"status": "notification_sent"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")



