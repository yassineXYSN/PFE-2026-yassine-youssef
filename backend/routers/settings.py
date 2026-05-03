import json
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..database.postgres import get_db, row
from ..dependencies import get_current_user

router = APIRouter(prefix="/api")


@router.get("/settings")
def get_settings(db=Depends(get_db), _user=Depends(get_current_user)):
    cur = db.cursor()
    cur.execute("SELECT settings FROM system_settings WHERE id = 'security'")
    record = cur.fetchone()
    return record["settings"] if record else {}


class SettingsUpdate(BaseModel):
    settings: dict


@router.post("/settings")
def save_settings(body: SettingsUpdate, db=Depends(get_db), current_user=Depends(get_current_user)):
    cur = db.cursor()
    cur.execute(
        "INSERT INTO system_settings (id, settings) VALUES ('security', %s) "
        "ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()",
        (json.dumps(body.settings),),
    )
    cur.execute(
        "INSERT INTO audit_logs (user_id, action, details) VALUES (%s, %s, %s)",
        (uuid.UUID(current_user["sub"]), "Mise à jour des paramètres de sécurité", json.dumps(body.settings)),
    )
    return {"status": "ok"}


@router.get("/audit")
def get_audit(db=Depends(get_db), _user=Depends(get_current_user)):
    cur = db.cursor()
    cur.execute(
        "SELECT id, user_id, action, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 5"
    )
    return [row(r) for r in cur.fetchall()]
