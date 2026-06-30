from datetime import datetime
import os
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from services.google_calendar import GoogleCalendarService

router = APIRouter(prefix="/auth/google", tags=["external_auth"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
PROFILE_KINDS = {
    "hr": {
        "collection": "hr_profiles",
        "lookup_field": "_id",
        "redirect_path": "/hr/parametres",
    },
    "candidat": {
        "collection": "candidates",
        "lookup_field": "user_id",
        "redirect_path": "/candidat/dashboard",
    },
}


def get_db():
    client = connect_mongodb()
    return client["HumatiQ"]


def _is_candidate_role(role: Optional[str]) -> bool:
    return (role or "").lower() in {"candidate", "candidat"}


def _profile_kind_for_role(role: Optional[str]) -> str:
    return "candidat" if _is_candidate_role(role) else "hr"


def _profile_query(kind: str, user_id: str) -> dict:
    return {PROFILE_KINDS[kind]["lookup_field"]: user_id}


def _load_profile_context(db, user_id: str, role: Optional[str] = None) -> dict:
    if role is not None:
        kind = _profile_kind_for_role(role)
        meta = PROFILE_KINDS[kind]
        query = _profile_query(kind, user_id)
        profile = db[meta["collection"]].find_one(query)
        return {
            "kind": kind,
            "profile": profile,
            "query": query,
            **meta,
        }

    hr_query = _profile_query("hr", user_id)
    hr_profile = db[PROFILE_KINDS["hr"]["collection"]].find_one(hr_query)
    if hr_profile:
        return {
            "kind": "hr",
            "profile": hr_profile,
            "query": hr_query,
            **PROFILE_KINDS["hr"],
        }

    candidat_query = _profile_query("candidat", user_id)
    candidat_profile = db[PROFILE_KINDS["candidat"]["collection"]].find_one(candidat_query)
    return {
        "kind": "candidat",
        "profile": candidat_profile,
        "query": candidat_query,
        **PROFILE_KINDS["candidat"],
    }


def _state_for_user(user_id: str, role: Optional[str]) -> str:
    return f"{_profile_kind_for_role(role)}:{user_id}"


def _parse_state(state: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not state:
        return None, None

    if ":" in state:
        kind, user_id = state.split(":", 1)
        if kind in PROFILE_KINDS and user_id:
            return kind, user_id

    return None, state


def _build_frontend_redirect(kind: str, success: bool, message: Optional[str] = None) -> str:
    resolved_kind = kind if kind in PROFILE_KINDS else "hr"
    base_url = f"{FRONTEND_URL}{PROFILE_KINDS[resolved_kind]['redirect_path']}"
    if success:
        return f"{base_url}?tab=connexions&google_sync=success"

    params = {"tab": "connexions", "google_sync": "error"}
    if message:
        params["msg"] = message
    return f"{base_url}?{urlencode(params)}"


def _get_sync_info(profile: Optional[dict]) -> dict:
    if not isinstance(profile, dict):
        return {"connected": False}
    return dict(profile.get("preferences", {}).get("google_calendar", {}) or {"connected": False})


def _ensure_profile_exists_for_auth(context: dict) -> None:
    if context["profile"] or context["kind"] == "candidat":
        return
    raise HTTPException(status_code=404, detail="Profile not found for Google Calendar sync")


def _build_calendar_service(db, context: dict, user_id: str, tokens: dict):
    google_service = GoogleCalendarService(db)
    service = google_service.get_calendar_service(
        user_id,
        tokens,
        collection_name=context["collection"],
        user_lookup_field=context["lookup_field"],
    )
    return google_service, service


# Scopes required for Google Calendar (read + write + user email)
SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
]


@router.get("/url")
async def get_google_auth_url(current_user: dict = Depends(get_current_user)):
    """Generate the Google OAuth2 authorization URL."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    db = get_db()
    context = _load_profile_context(db, current_user["id"], current_user.get("role"))
    _ensure_profile_exists_for_auth(context)

    print(f"DEBUG: Generating Google Auth URL for user: {current_user.get('email')}")
    print(f"DEBUG: CLIENT_ID prefix: {client_id[:10] if client_id else 'MISSING'}")
    print(f"DEBUG: REDIRECT_URI: {redirect_uri}")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth2 credentials not configured on server.")

    client_config = {
        "web": {
            "client_id": client_id,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": client_secret,
            "redirect_uris": [redirect_uri],
        }
    }

    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = redirect_uri

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        state=_state_for_user(current_user["id"], current_user.get("role")),
    )

    db[context["collection"]].update_one(
        context["query"],
        {"$set": {"preferences.google_calendar.code_verifier": flow.code_verifier}},
        upsert=(context["kind"] == "candidat"),
    )

    print(f"DEBUG: Auth URL generated: {authorization_url[:50]}...")
    return {"url": authorization_url}


@router.get("/callback")
async def google_auth_callback(request: Request):
    """Handle the Google OAuth2 callback."""
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    state_kind, state_user_id = _parse_state(state)
    redirect_kind = state_kind or "hr"

    print(f"DEBUG: Callback received. Code: {bool(code)}, State: {state}")

    if not code or not state:
        print("DEBUG: Missing code or state in callback")
        return RedirectResponse(url=_build_frontend_redirect(redirect_kind, success=False, message="missing_params"))

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }

    try:
        flow = Flow.from_client_config(client_config, scopes=SCOPES)
        flow.redirect_uri = redirect_uri

        db = get_db()
        context = _load_profile_context(db, state_user_id, state_kind)
        redirect_kind = context["kind"]
        _ensure_profile_exists_for_auth(context)

        profile = context["profile"] or {}
        verifier = profile.get("preferences", {}).get("google_calendar", {}).get("code_verifier")

        print(f"DEBUG: Fetching token for code: {code[:10]}... (Verifier present: {bool(verifier)})")
        fetch_kwargs = {"code": code}
        if verifier:
            fetch_kwargs["code_verifier"] = verifier
        flow.fetch_token(**fetch_kwargs)
        credentials = flow.credentials
        print(f"DEBUG: Successfully fetched token for user {state_user_id}")

        user_info_service = build("oauth2", "v2", credentials=credentials)
        user_info = user_info_service.userinfo().get().execute()
        google_email = user_info.get("email")
        print(f"DEBUG: Connected to Google account: {google_email}")

        token_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes,
            "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
        }

        print(f"DEBUG: Updating {context['kind']} profile {state_user_id} with Google tokens and email...")
        result = db[context["collection"]].update_one(
            context["query"],
            {
                "$set": {
                    "preferences.google_calendar": {
                        "connected": True,
                        "email": google_email,
                        "tokens": token_data,
                        "last_sync": datetime.utcnow().isoformat(),
                    },
                    "updated_at": datetime.utcnow(),
                }
            },
            upsert=(context["kind"] == "candidat"),
        )
        print(f"DEBUG: DB update result: matched={result.matched_count}, modified={result.modified_count}")

        return RedirectResponse(url=_build_frontend_redirect(context["kind"], success=True))

    except Exception as e:
        import traceback

        error_msg = str(e)
        print(f"DEBUG: Error in Google callback: {error_msg}")
        print(traceback.format_exc())

        if state_user_id:
            try:
                db = get_db()
                context = _load_profile_context(db, state_user_id, state_kind)
                redirect_kind = context["kind"]
            except Exception:
                pass

        return RedirectResponse(url=_build_frontend_redirect(redirect_kind, success=False, message=error_msg))


@router.get("/events")
async def get_google_calendar_events(current_user: dict = Depends(get_current_user)):
    """Fetch events from the connected Google Calendar."""
    db = get_db()
    context = _load_profile_context(db, current_user["id"], current_user.get("role"))
    sync_info = _get_sync_info(context["profile"])

    if not sync_info.get("connected"):
        print(f"DEBUG /events: User {current_user['id']} is not connected to Google")
        return []

    tokens = sync_info.get("tokens")
    if not tokens:
        print(f"DEBUG /events: No tokens stored for user {current_user['id']}")
        return []

    print(f"DEBUG /events: Building calendar service for user {current_user['id']}...")
    google_service, service = _build_calendar_service(db, context, current_user["id"], tokens)

    if not service:
        print(f"DEBUG /events: Could not build calendar service for user {current_user['id']} - token issue")
        return []

    print(f"DEBUG /events: Fetching events for user {current_user['id']}...")
    events = google_service.fetch_events(service)
    print(f"DEBUG /events: Returning {len(events)} events")
    return events


@router.get("/status")
async def get_google_sync_status(current_user: dict = Depends(get_current_user)):
    """Check if Google Calendar is connected and ensure email is present."""
    db = get_db()
    context = _load_profile_context(db, current_user["id"], current_user.get("role"))
    sync_info = _get_sync_info(context["profile"])

    if sync_info.get("connected") and not sync_info.get("email"):
        tokens = sync_info.get("tokens")
        if tokens:
            try:
                _, service = _build_calendar_service(db, context, current_user["id"], tokens)
                if service:
                    user_info_service = build("oauth2", "v2", credentials=service._credentials)
                    user_info = user_info_service.userinfo().get().execute()
                    google_email = user_info.get("email")
                    if google_email:
                        db[context["collection"]].update_one(
                            context["query"],
                            {"$set": {"preferences.google_calendar.email": google_email}},
                        )
                        sync_info["email"] = google_email
            except Exception as e:
                print(f"Error fetching missing Google email: {e}")

    return sync_info


@router.get("/debug")
async def google_debug(current_user: dict = Depends(get_current_user)):
    """Debug endpoint: returns full Google sync state for diagnosing connection issues."""
    db = get_db()
    context = _load_profile_context(db, current_user["id"], current_user.get("role"))
    profile = context["profile"]
    if not profile:
        return {"error": "Profile not found", "user_id": current_user["id"]}

    sync_info = _get_sync_info(profile)
    tokens = sync_info.get("tokens", {})
    scopes = tokens.get("scopes", [])

    has_write_scope = any("calendar.events" in scope and "readonly" not in scope for scope in (scopes or []))

    return {
        "user_id": current_user["id"],
        "profile_kind": context["kind"],
        "user_email": profile.get("email"),
        "connected": sync_info.get("connected", False),
        "google_email": sync_info.get("email", "MISSING"),
        "has_tokens": bool(tokens),
        "has_refresh_token": bool(tokens.get("refresh_token")),
        "token_expiry": tokens.get("expiry"),
        "scopes": scopes,
        "has_write_scope": has_write_scope,
        "last_sync": sync_info.get("last_sync"),
        "action_required": "Disconnect and reconnect Google to get write permissions" if not has_write_scope else "OK",
    }
