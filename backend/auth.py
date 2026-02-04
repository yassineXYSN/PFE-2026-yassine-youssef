from fastapi import APIRouter

router = APIRouter()


@router.get("/login", tags=["auth"])
async def login_info():
    """
    Placeholder login endpoint.
    The React frontend renders the actual login page; this route is here
    to keep authentication-related API endpoints organized under their own router.
    """
    return {"message": "NextHire AI login endpoint"}



