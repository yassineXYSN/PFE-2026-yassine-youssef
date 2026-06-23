from datetime import datetime
import logging

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)


class GoogleCalendarService:
    def __init__(self, db):
        self.db = db

    def get_calendar_service(
        self,
        user_id,
        tokens,
        collection_name="hr_profiles",
        user_lookup_field="_id",
    ):
        """
        Returns a Google Calendar API service object, refreshing tokens if necessary.
        """
        required_fields = ("token", "client_id", "client_secret")
        missing_fields = [field for field in required_fields if not tokens.get(field)]
        if missing_fields:
            logger.warning(
                "Missing Google credential fields for user %s: %s",
                user_id,
                ", ".join(missing_fields),
            )
            return None

        # Parse expiry into a naive UTC datetime because google-auth compares against utcnow().
        expiry = None
        if tokens.get("expiry"):
            try:
                expiry_str = tokens["expiry"]
                expiry_str = expiry_str.replace("Z", "").split("+")[0].split(".")[0]
                expiry = datetime.fromisoformat(expiry_str)
            except Exception as e:
                logger.warning(f"Could not parse token expiry '{tokens.get('expiry')}': {e}")

        creds = Credentials(
            token=tokens["token"],
            refresh_token=tokens.get("refresh_token"),
            token_uri=tokens.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=tokens["client_id"],
            client_secret=tokens["client_secret"],
            scopes=tokens.get("scopes"),
            expiry=expiry,
        )

        print(f"DEBUG: Credentials for user {user_id}: expired={creds.expired}, has_refresh={bool(creds.refresh_token)}, scopes={creds.scopes}")

        if creds.expired and creds.refresh_token:
            try:
                logger.info(f"Refreshing Google tokens for user {user_id}")
                print(f"DEBUG: Refreshing token for user {user_id}...")
                creds.refresh(GoogleRequest())
                print("DEBUG: Token refreshed successfully.")

                self.db[collection_name].update_one(
                    {user_lookup_field: user_id},
                    {
                        "$set": {
                            "preferences.google_calendar.tokens.token": creds.token,
                            "preferences.google_calendar.tokens.expiry": creds.expiry.isoformat() if creds.expiry else None,
                        }
                    },
                )
            except Exception as e:
                logger.error(f"Failed to refresh Google tokens for user {user_id}: {e}")
                print(f"DEBUG: Token refresh FAILED for user {user_id}: {e}")
                return None

        return build("calendar", "v3", credentials=creds)

    def fetch_events(self, service, max_results=100):
        """
        Fetches events from the primary calendar (past 30 days + future).
        """
        try:
            from datetime import timedelta

            time_min = (datetime.utcnow() - timedelta(days=30)).isoformat() + "Z"
            events_result = service.events().list(
                calendarId="primary",
                timeMin=time_min,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            ).execute()

            events = events_result.get("items", [])
            logger.info(f"Successfully fetched {len(events)} events from Google")
            print(f"DEBUG: Fetched {len(events)} events from Google for sync")

            formatted_events = []
            for event in events:
                start = event["start"].get("dateTime", event["start"].get("date"))
                end = event["end"].get("dateTime", event["end"].get("date"))
                formatted_events.append(
                    {
                        "id": event["id"],
                        "summary": event.get("summary", "No Title"),
                        "start": start,
                        "end": end,
                        "location": event.get("location"),
                        "source": "google",
                    }
                )
            return formatted_events
        except Exception as e:
            logger.error(f"Error fetching Google events: {e}")
            return []

    def create_event(self, service, interview_data):
        """
        Creates a new event in the primary calendar for an interview.
        """
        try:
            event = {
                "summary": f"Interview: {interview_data['candidate_name']} ({interview_data['type']})",
                "description": f"Interview scheduled via HumatiQ for candidate {interview_data['candidate_name']} ({interview_data['candidate_email']}).",
                "start": {
                    "dateTime": interview_data["start_time"],
                    "timeZone": "UTC",
                },
                "end": {
                    "dateTime": interview_data["end_time"],
                    "timeZone": "UTC",
                },
                "attendees": [
                    {"email": interview_data["candidate_email"]},
                ],
                "reminders": {
                    "useDefault": True,
                },
            }

            created_event = service.events().insert(calendarId="primary", body=event).execute()
            logger.info(f"Created Google Calendar event: {created_event.get('htmlLink')}")
            print(f"DEBUG: Created Google event {created_event.get('id')}")
            return created_event.get("id")
        except Exception as e:
            logger.error(f"Error creating Google Calendar event: {e}")
            return None

    def update_event(self, service, event_id, interview_data):
        """
        Updates an existing event in the primary calendar.
        """
        try:
            event = service.events().get(calendarId="primary", eventId=event_id).execute()

            if "candidate_name" in interview_data and "type" in interview_data:
                event["summary"] = f"Interview: {interview_data['candidate_name']} ({interview_data['type']})"
                event["description"] = f"Interview scheduled via HumatiQ for candidate {interview_data['candidate_name']} ({interview_data.get('candidate_email', '')})."

            if "start_time" in interview_data:
                event["start"] = {
                    "dateTime": interview_data["start_time"].isoformat() if isinstance(interview_data["start_time"], datetime) else interview_data["start_time"],
                    "timeZone": "UTC",
                }
            if "end_time" in interview_data:
                event["end"] = {
                    "dateTime": interview_data["end_time"].isoformat() if isinstance(interview_data["end_time"], datetime) else interview_data["end_time"],
                    "timeZone": "UTC",
                }
            if "candidate_email" in interview_data:
                event["attendees"] = [{"email": interview_data["candidate_email"]}]

            updated_event = service.events().update(calendarId="primary", eventId=event_id, body=event).execute()
            logger.info(f"Updated Google Calendar event: {updated_event.get('htmlLink')}")
            print(f"DEBUG: Updated Google event {updated_event.get('id')}")
            return True
        except Exception as e:
            logger.error(f"Error updating Google Calendar event: {e}")
            return False

    def delete_event(self, service, event_id):
        """
        Deletes an event from the primary calendar.
        """
        try:
            service.events().delete(calendarId="primary", eventId=event_id).execute()
            logger.info(f"Deleted Google Calendar event: {event_id}")
            print(f"DEBUG: Deleted Google event {event_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting Google Calendar event: {e}")
            return False
