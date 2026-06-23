from fastapi import APIRouter, Depends, HTTPException
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/parametrage", tags=["parametrage"])


def get_db():
    try:
        client = connect_mongodb()
        if not client:
            raise Exception("MongoClient returned None")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")
    return client["HumatiQ"]


# Default AI scoring parameters — used when no document exists yet
AI_SCORING_DEFAULTS = {
    "ai_enabled": True,
    "top_x_candidates": 25,
    "top_y_candidates": 10,
    "top_z_candidates": 5,
    "similarity_threshold": 50,
    "quiz_default_duration": 10,
    "quiz_default_questions": 10,
    "quiz_default_difficulty": "medium",
}


def _ensure_ai_scoring(db, company_id: str) -> dict:
    """Return the AI scoring parametrage doc, creating it with defaults if missing."""
    collection = db["parametrage"]
    doc = collection.find_one({"company_id": company_id, "category": "ai_scoring"})
    if doc:
        doc["_id"] = str(doc["_id"])
        return doc

    now = datetime.utcnow().isoformat()
    new_doc = {
        "company_id": company_id,
        "category": "ai_scoring",
        "parameters": {**AI_SCORING_DEFAULTS},
        "updated_at": now,
        "updated_by": None,
    }
    result = collection.insert_one(new_doc)
    new_doc["_id"] = str(result.inserted_id)
    return new_doc


# ── GET  /api/parametrage/ai-scoring ─────────────────────────────────────────
@router.get("/ai-scoring")
async def get_ai_scoring(current_user: dict = Depends(get_current_user)):
    db = get_db()

    # Resolve company_id from the user's profile
    profile = db.hr_profiles.find_one({"_id": current_user["id"]})
    if not profile or not profile.get("company_id"):
        raise HTTPException(status_code=400, detail="User profile missing company_id")

    company_id = profile["company_id"]
    doc = _ensure_ai_scoring(db, company_id)
    return {
        "category": "ai_scoring",
        "company_id": company_id,
        "parameters": doc["parameters"],
        "updated_at": doc.get("updated_at"),
        "updated_by": doc.get("updated_by"),
    }


# ── PUT  /api/parametrage/ai-scoring ─────────────────────────────────────────
@router.put("/ai-scoring")
async def update_ai_scoring(body: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()

    profile = db.hr_profiles.find_one({"_id": current_user["id"]})
    if not profile or not profile.get("company_id"):
        raise HTTPException(status_code=400, detail="User profile missing company_id")

    company_id = profile["company_id"]
    params = body.get("parameters", {})

    # Validate the incoming parameters
    errors = _validate_ai_params(params)
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    # Ensure the document exists first
    _ensure_ai_scoring(db, company_id)

    now = datetime.utcnow().isoformat()
    db["parametrage"].update_one(
        {"company_id": company_id, "category": "ai_scoring"},
        {"$set": {
            "parameters": params,
            "updated_at": now,
            "updated_by": current_user["id"],
        }},
    )

    return {
        "category": "ai_scoring",
        "company_id": company_id,
        "parameters": params,
        "updated_at": now,
        "updated_by": current_user["id"],
        "message": "AI scoring parameters updated successfully",
    }


# ── POST /api/parametrage/ai-scoring/reset ───────────────────────────────────
@router.post("/ai-scoring/reset")
async def reset_ai_scoring(current_user: dict = Depends(get_current_user)):
    db = get_db()

    profile = db.hr_profiles.find_one({"_id": current_user["id"]})
    if not profile or not profile.get("company_id"):
        raise HTTPException(status_code=400, detail="User profile missing company_id")

    company_id = profile["company_id"]
    now = datetime.utcnow().isoformat()

    db["parametrage"].update_one(
        {"company_id": company_id, "category": "ai_scoring"},
        {"$set": {
            "parameters": {**AI_SCORING_DEFAULTS},
            "updated_at": now,
            "updated_by": current_user["id"],
        }},
        upsert=True,
    )

    return {
        "category": "ai_scoring",
        "company_id": company_id,
        "parameters": {**AI_SCORING_DEFAULTS},
        "updated_at": now,
        "message": "AI scoring parameters reset to defaults",
    }


def _validate_ai_params(params: dict) -> list:
    errors = []

    ai_enabled = params.get("ai_enabled")
    if not isinstance(ai_enabled, bool):
        errors.append("ai_enabled must be a boolean")

    x = params.get("top_x_candidates")
    y = params.get("top_y_candidates")
    z = params.get("top_z_candidates")

    if not isinstance(x, int) or x <= 0:
        errors.append("top_x_candidates must be a positive integer")
    if not isinstance(y, int) or y <= 0:
        errors.append("top_y_candidates must be a positive integer")
    if not isinstance(z, int) or z <= 0:
        errors.append("top_z_candidates must be a positive integer")

    if isinstance(x, int) and isinstance(y, int) and x <= y:
        errors.append("top_x_candidates must be greater than top_y_candidates")
    if isinstance(y, int) and isinstance(z, int) and y <= z:
        errors.append("top_y_candidates must be greater than top_z_candidates")

    threshold = params.get("similarity_threshold")
    if not isinstance(threshold, int) or threshold < 0 or threshold > 100:
        errors.append("similarity_threshold must be an integer between 0 and 100")

    quiz_dur = params.get("quiz_default_duration")
    if not isinstance(quiz_dur, int) or quiz_dur <= 0:
        errors.append("quiz_default_duration must be a positive integer")

    quiz_q = params.get("quiz_default_questions")
    if not isinstance(quiz_q, int) or quiz_q <= 0:
        errors.append("quiz_default_questions must be a positive integer")

    quiz_diff = params.get("quiz_default_difficulty")
    if quiz_diff not in ("easy", "medium", "hard"):
        errors.append("quiz_default_difficulty must be one of: easy, medium, hard")

    return errors
