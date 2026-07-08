from typing import Optional

from bson import ObjectId
from jose import jwt, JWTError

from dependencies import SECRET_KEY, ALGORITHM


def decode_ws_token(token: Optional[str]) -> Optional[dict]:
    """Decode a JWT passed as a WebSocket query param. Returns claims or None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if not payload.get("id") or not payload.get("role"):
        return None
    return payload


def user_is_interview_participant(db, room_id: str, user_id: str) -> bool:
    """True if user_id is the recruiter on the interview, or the candidate on
    the linked application."""
    if not ObjectId.is_valid(room_id):
        return False
    interview = db.hr_interviews.find_one({"_id": ObjectId(room_id)})
    if not interview:
        return False
    if str(interview.get("recruiter_id")) == str(user_id):
        return True
    app_id = interview.get("application_id")
    if app_id and ObjectId.is_valid(str(app_id)):
        appdoc = db.job_applications.find_one({"_id": ObjectId(app_id)})
        if appdoc and str(appdoc.get("candidate_id") or appdoc.get("user_id")) == str(user_id):
            return True
    return False
