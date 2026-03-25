from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
import os
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import json
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/auth/google", tags=["external_auth"])

def get_db():
    client = connect_mongodb()
    return client["HumatiQ"]

# Scopes required for Google Calendar
SCOPES = ['https://www.googleapis.com/auth/calendar.events.readonly', 'https://www.googleapis.com/auth/userinfo.email', 'openid']

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

    print(f"DEBUG: Google Callback received. Code present: {bool(code)}, State (User ID): {state}")

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
        
        # Store tokens in MongoDB profile
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

        print(f"DEBUG: Updating profile {state} with Google tokens...")
        result = db.hr_profiles.update_one(
            {"_id": state},
            {"$set": {
                "preferences.google_calendar": {
                    "connected": True,
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
        return []

    tokens = sync_info.get("tokens")
    if not tokens:
        return []

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest
    
    creds = Credentials(
        token=tokens["token"],
        refresh_token=tokens["refresh_token"],
        token_uri=tokens["token_uri"],
        client_id=tokens["client_id"],
        client_secret=tokens["client_secret"],
        scopes=tokens["scopes"]
    )

    # Refresh token if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        # Update stored tokens
        db.hr_profiles.update_one(
            {"_id": current_user["id"]},
            {"$set": {
                "preferences.google_calendar.tokens.token": creds.token,
                "preferences.google_calendar.tokens.expiry": creds.expiry.isoformat() if creds.expiry else None
            }}
        )

    try:
        service = build('calendar', 'v3', credentials=creds)
        # Fetch events from the last 30 days to the next 60 days
        now = datetime.utcnow().isoformat() + 'Z'  # 'Z' indicates UTC time
        events_result = service.events().list(calendarId='primary', timeMin=now,
                                              maxResults=50, singleEvents=True,
                                              orderBy='startTime').execute()
        events = events_result.get('items', [])

        # Transform and return
        formatted_events = []
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))
            formatted_events.append({
                "id": event['id'],
                "summary": event.get('summary', 'No Title'),
                "start": start,
                "end": end,
                "location": event.get('location'),
                "source": "google"
            })
        return formatted_events

    except Exception as e:
        print(f"Error fetching Google events: {e}")
        return []

@router.get("/status")
async def get_google_sync_status(current_user: dict = Depends(get_current_user)):
    """Check if Google Calendar is connected."""
    db = get_db()
    profile = db.hr_profiles.find_one({"_id": current_user["id"]})
    
    sync_info = profile.get("preferences", {}).get("google_calendar", {})
    return sync_info
