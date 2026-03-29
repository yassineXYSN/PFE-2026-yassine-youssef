"""
utils/schedulers.py – Background scheduler for interview reminders.

Polls `hr_interviews` every 15 minutes for upcoming "scheduled" interviews
and sends email reminders to both candidates and recruiters:
  - 24 hours before the meeting
  - 1 hour before the meeting

De-duplication is handled via `reminder_24h_sent` and `reminder_1h_sent`
boolean flags stored on each interview document.
"""

import asyncio
from datetime import datetime, timedelta
from database.mongodb import connect_mongodb
from bson import ObjectId
from utils.email import send_email


def get_db():
    """Get the HumatiQ MongoDB database handle."""
    client = connect_mongodb()
    if not client:
        raise RuntimeError("Cannot connect to MongoDB")
    return client["HumatiQ"]


async def _send_reminder(interview: dict, window: str) -> None:
    """Send reminder emails to both candidate and recruiter for a given window."""
    db = get_db()

    candidate_name  = interview.get("candidate_name", "Candidat")
    candidate_email = interview.get("candidate_email")
    start_time: datetime = interview["start_time"]
    interview_type  = interview.get("type", "")

    date_str = start_time.strftime("%A %d %B %Y")
    time_str = start_time.strftime("%H:%M")
    window_label = "24 heures" if window == "24h" else "1 heure"

    # ── Candidate reminder ──────────────────────────────────────────────────
    if candidate_email:
        try:
            content = (
                f"Bonjour {candidate_name},\n\n"
                f"Rappel : votre entretien est prévu dans {window_label}.\n\n"
                f"Date  : {date_str}\n"
                f"Heure : {time_str}\n"
                f"Type  : {interview_type}\n\n"
                f"Connectez-vous à votre espace HumatiQ pour plus de détails.\n\n"
                f"Cordialement,\nL'équipe HumatiQ"
            )
            await send_email(
                to_email=candidate_email,
                subject=f"Rappel entretien dans {window_label}",
                content=content,
            )
        except Exception as exc:
            print(f"[Scheduler] Could not send {window} reminder to candidate: {exc}")

    # ── Recruiter reminder ──────────────────────────────────────────────────
    recruiter_id = interview.get("recruiter_id")
    if recruiter_id:
        try:
            recruiter_profile = (
                db.hr_profiles.find_one({"_id": recruiter_id})
                or db.hr_profiles.find_one({"_id": ObjectId(recruiter_id)})
            )
            recruiter_email = recruiter_profile.get("email") if recruiter_profile else None

            if recruiter_email:
                content = (
                    f"Bonjour,\n\n"
                    f"Rappel : l'entretien avec {candidate_name} est prévu dans {window_label}.\n\n"
                    f"Date  : {date_str}\n"
                    f"Heure : {time_str}\n"
                    f"Type  : {interview_type}\n\n"
                    f"Retrouvez les détails dans votre tableau de bord HumatiQ.\n\n"
                    f"Cordialement,\nL'équipe HumatiQ"
                )
                await send_email(
                    to_email=recruiter_email,
                    subject=f"Rappel entretien dans {window_label} – {candidate_name}",
                    content=content,
                )
        except Exception as exc:
            print(f"[Scheduler] Could not send {window} reminder to recruiter: {exc}")


async def _check_and_send_reminders() -> None:
    """Single pass: find interviews needing a reminder and email them."""
    db = get_db()
    now = datetime.utcnow()

    # Window boundaries
    window_24h_start = now + timedelta(hours=23, minutes=45)
    window_24h_end   = now + timedelta(hours=24, minutes=15)
    window_1h_start  = now + timedelta(minutes=45)
    window_1h_end    = now + timedelta(hours=1, minutes=15)

    try:
        interviews = list(
            db.hr_interviews.find({"status": "scheduled"})
        )
    except Exception as exc:
        print(f"[Scheduler] DB error fetching interviews: {exc}")
        return

    for interview in interviews:
        iid = interview["_id"]
        start: datetime = interview.get("start_time")
        if not start:
            continue

        # ── 24 h reminder ──────────────────────────────────────────────────
        if not interview.get("reminder_24h_sent") and window_24h_start <= start <= window_24h_end:
            print(f"[Scheduler] Sending 24h reminder for interview {iid}")
            await _send_reminder(interview, "24h")
            db.hr_interviews.update_one(
                {"_id": iid},
                {"$set": {"reminder_24h_sent": True}},
            )

        # ── 1 h reminder ───────────────────────────────────────────────────
        if not interview.get("reminder_1h_sent") and window_1h_start <= start <= window_1h_end:
            print(f"[Scheduler] Sending 1h reminder for interview {iid}")
            await _send_reminder(interview, "1h")
            db.hr_interviews.update_one(
                {"_id": iid},
                {"$set": {"reminder_1h_sent": True}},
            )


async def start_reminder_scheduler(interval_seconds: int = 900) -> None:
    """
    Infinite async loop that checks for pending reminders.
    interval_seconds defaults to 900 (every 15 minutes).
    Call this inside the FastAPI lifespan as an asyncio.Task.
    """
    print(f"[Scheduler] Interview reminder scheduler started (interval={interval_seconds}s)")
    while True:
        try:
            await _check_and_send_reminders()
        except Exception as exc:
            print(f"[Scheduler] Unexpected error: {exc}")
        await asyncio.sleep(interval_seconds)
