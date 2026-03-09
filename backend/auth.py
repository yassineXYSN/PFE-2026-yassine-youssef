from fastapi import APIRouter

router = APIRouter()

@router.get("/login", tags=["auth"])
async def login_info():
    """
    Placeholder login endpoint.
    The actual login is handled by the frontend directly with Supabase.
    """
    return {"message": "HumatiQ login system (Client-side)"}



