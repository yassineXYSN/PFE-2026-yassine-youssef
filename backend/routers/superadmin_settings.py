from fastapi import APIRouter, Depends, HTTPException
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/superadmin-settings", tags=["superadmin-settings"])

SECURITY_DEFAULTS = {
    "minPasswordLength": 16,
    "requireComplexPassword": True,
    "sessionTimeout": 30,
    "ipWhitelist": "",
}


def get_db():
    try:
        client = connect_mongodb()
        if not client:
            raise Exception("MongoClient returned None")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")
    return client["HumatiQ"]


# ── GET /api/superadmin-settings ─────────────────────────────────────────────
@router.get("")
async def get_settings(current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db["superadmin_settings"].find_one({"_id": "security"})
    if not doc:
        return {"settings": {**SECURITY_DEFAULTS}}
    return {"settings": doc.get("settings", {**SECURITY_DEFAULTS})}


# ── PUT /api/superadmin-settings ─────────────────────────────────────────────
@router.put("")
async def save_settings(body: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    settings = body.get("settings", {})
    now = datetime.utcnow().isoformat()

    db["superadmin_settings"].update_one(
        {"_id": "security"},
        {"$set": {"settings": settings, "updated_at": now}},
        upsert=True,
    )

    db["superadmin_audit_logs"].insert_one({
        "user_id": current_user.get("id"),
        "action": body.get("action", "Mise à jour des paramètres de sécurité"),
        "details": {**settings, **body.get("extra_details", {})},
        "created_at": now,
    })

    return {"message": "Paramètres enregistrés avec succès !", "updated_at": now}


# ── GET /api/superadmin-settings/audit-logs ───────────────────────────────────
@router.get("/audit-logs")
async def get_audit_logs(limit: int = 5, current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db["superadmin_audit_logs"].find().sort("created_at", -1).limit(limit)
    logs = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        logs.append(doc)
    return logs
