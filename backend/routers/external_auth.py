from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
import os
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import json
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from datetime import datetime
from services.google_calendar import GoogleCalendarService

router = APIRouter(prefix="/auth/google", tags=["external_auth"])

def get_db():
    client = connect_mongodb()
    return client["HumatiQ"]

# Scopes required for Google Calendar (read + write + user email)
SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',  # Read AND write calendar events
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]

@router.get("/url")
async def get_google_auth_url(current_user: dict = Depends(get_current_user)):
    """Generate the Google OAuth2 authorization URL."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

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
            "redirect_uris": [redirect_uri]
        }
    }

    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = redirect_uri

    # Use state to pass the user ID so we can associate the token with the correct profile in callback
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        state=current_user["id"] # Pass the user ID as state
    )

    # NEW: Store code_verifier for PKCE in MongoDB temporarily
    db = get_db()
    db.hr_profiles.update_one(
        {"_id": current_user["id"]},
        {"$set": {"preferences.google_calendar.code_verifier": flow.code_verifier}}
    )

    print(f"DEBUG: Auth URL generated: {authorization_url[:50]}...")
    return {"url": authorization_url}

@router.get("/callback")
async def google_auth_callback(request: Request):
    """Handle the Google OAuth2 callback."""
    code = request.query_params.get("code")
    state = request.query_params.get("state") # This is the user ID

    print(f"DEBUG: Callback received. Code: {bool(code)}, State: {state}")

    if not code or not state:
        print("DEBUG: Missing code or state in callback")
        return RedirectResponse(url="http://localhost:5173/hr/settings?error=missing_params")

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }

    try:
        flow = Flow.from_client_config(client_config, scopes=SCOPES)
        flow.redirect_uri = redirect_uri
        
        # NEW: Retrieve code_verifier from MongoDB
        db = get_db()
        profile = db.hr_profiles.find_one({"_id": state})
        verifier = profile.get("preferences", {}).get("google_calendar", {}).get("code_verifier")
        
        print(f"DEBUG: Fetching token for code: {code[:10]}... (Verifier present: {bool(verifier)})")
        flow.fetch_token(code=code, code_verifier=verifier)
        credentials = flow.credentials
        print(f"DEBUG: Successfully fetched token for user {state}")
        
        # NEW: Fetch user email from Google
        user_info_service = build('oauth2', 'v2', credentials=credentials)
        user_info = user_info_service.userinfo().get().execute()
        google_email = user_info.get("email")
        print(f"DEBUG: Connected to Google account: {google_email}")
        
        # Store tokens and email in MongoDB profile
        db = get_db()
        token_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes,
            "expiry": credentials.expiry.isoformat() if credentials.expiry else None
        }

        print(f"DEBUG: Updating profile {state} with Google tokens and email...")
        result = db.hr_profiles.update_one(
            {"_id": state},
            {"$set": {
                "preferences.google_calendar": {
                    "connected": True,
                    "email": google_email,
                    "tokens": token_data,
                    "last_sync": datetime.utcnow().isoformat()
                },
                "updated_at": datetime.utcnow()
            }}
        )
        print(f"DEBUG: DB update result: matched={result.matched_count}, modified={result.modified_count}")

        # Redirect back to frontend settings
        return RedirectResponse(url="http://localhost:5173/hr/settings?google_sync=success")

    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"DEBUG: Error in Google callback: {error_msg}")
        print(traceback.format_exc())
        return RedirectResponse(url=f"http://localhost:5173/hr/settings?google_sync=error&msg={error_msg}")

@router.get("/events")
async def get_google_calendar_events(current_user: dict = Depends(get_current_user)):
    """Fetch events from connected Google Calendar."""
    db = get_db()
    profile = db.hr_profiles.find_one({"_id": current_user["id"]})
    
    sync_info = profile.get("preferences", {}).get("google_calendar", {})
    if not sync_info or not sync_info.get("connected"):
        print(f"DEBUG /events: User {current_user['id']} is not connected to Google")
        return []

    tokens = sync_info.get("tokens")
    if not tokens:
        print(f"DEBUG /events: No tokens stored for user {current_user['id']}")
        return []

    print(f"DEBUG /events: Building calendar service for user {current_user['id']}...")
    google_service = GoogleCalendarService(db)
    service = google_service.get_calendar_service(current_user["id"], tokens)
    
    if not service:
        print(f"DEBUG /events: Could not build calendar service for user {current_user['id']} — token issue")
        return []

    print(f"DEBUG /events: Fetching events for user {current_user['id']}...")
    events = google_service.fetch_events(service)
    print(f"DEBUG /events: Returning {len(events)} events")
    return events

@router.get("/status")
async def get_google_sync_status(current_user: dict = Depends(get_current_user)):
    """Check if Google Calendar is connected and ensure email is present."""
    db = get_db()
    profile = db.hr_profiles.find_one({"_id": current_user["id"]})
    
    sync_info = profile.get("preferences", {}).get("google_calendar", {})
    
    # If connected but email is missing (e.g. connected before our update), fetch it now
    if sync_info.get("connected") and not sync_info.get("email"):
        tokens = sync_info.get("tokens")
        if tokens:
            try:
                google_service = GoogleCalendarService(db)
                # This will also refresh tokens if needed
                service = google_service.get_calendar_service(current_user["id"], tokens)
                if service:
                    user_info_service = build('oauth2', 'v2', credentials=service._credentials)
                    user_info = user_info_service.userinfo().get().execute()
                    google_email = user_info.get("email")
                    if google_email:
                        db.hr_profiles.update_one(
                            {"_id": current_user["id"]},
                            {"$set": {"preferences.google_calendar.email": google_email}}
                        )
                        sync_info["email"] = google_email
            except Exception as e:
                print(f"Error fetching missing Google email: {e}")
                
    return sync_info


@router.get("/debug")
async def google_debug(current_user: dict = Depends(get_current_user)):
    """Debug endpoint: returns full Google sync state for diagnosing connection issues."""
    db = get_db()
    profile = db.hr_profiles.find_one({"_id": current_user["id"]})
    if not profile:
        return {"error": "Profile not found", "user_id": current_user["id"]}
    
    sync_info = profile.get("preferences", {}).get("google_calendar", {})
    tokens = sync_info.get("tokens", {})
    scopes = tokens.get("scopes", [])
    
    has_write_scope = any("calendar.events" in s and "readonly" not in s for s in (scopes or []))
    
    return {
        "user_id": current_user["id"],
        "user_email": profile.get("email"),
        "connected": sync_info.get("connected", False),
        "google_email": sync_info.get("email", "MISSING"),
        "has_tokens": bool(tokens),
        "has_refresh_token": bool(tokens.get("refresh_token")),
        "token_expiry": tokens.get("expiry"),
        "scopes": scopes,
        "has_write_scope": has_write_scope,
        "last_sync": sync_info.get("last_sync"),
        "action_required": "Disconnect and reconnect Google to get write permissions" if not has_write_scope else "OK"
    }
