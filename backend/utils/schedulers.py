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
from database.mongodb_async import get_async_db
from utils.notifications import create_notification


def get_db():
    """Get the HumatiQ MongoDB database handle."""
    client = connect_mongodb()
    if not client:
        raise RuntimeError("Cannot connect to MongoDB")
    return client["HumatiQ"]


async def _send_reminder(interview: dict, window: str) -> None:
    """Send reminder emails with localized time and accurate remaining duration."""
    db = get_db()
    candidate_name = interview.get("candidate_name", "Candidat")
    candidate_email = interview.get("candidate_email")
    start_time_utc: datetime = interview["start_time"]
    
    # Force localized display for user (GMT+1)
    start_time_local = start_time_utc + timedelta(hours=1)
    date_str = start_time_local.strftime("%A %d %B %Y")
    time_str = start_time_local.strftime("%H:%M")
    
    # Calculate real human-readable remaining time to avoid discrepancy
    now_utc = datetime.utcnow()
    diff = start_time_utc - now_utc
    minutes_left = int(diff.total_seconds() / 60)
    
    if minutes_left > 120:
        remaining_label = f"environ {round(minutes_left/60)} heures"
    elif minutes_left > 40:
        remaining_label = "environ 1 heure"
    else:
        remaining_label = f"{max(0, minutes_left)} minutes"

    if candidate_email:
        try:
            if window == "5m":
                interview_id = str(interview.get("_id", ""))
                link = f"http://localhost:5173/candidat/interviews/room/{interview_id}"
                subject = "Votre entretien commence maintenant !"
                content = (
                    f"Bonjour {candidate_name},\n\n"
                    f"Votre entretien commence dans {remaining_label} !\n\n"
                    f"Cliquez sur ce lien pour rejoindre la salle :\n"
                    f"{link}\n\n"
                    f"Cordialement,\nL'équipe HumatiQ"
                )
            else:
                subject = f"Rappel : votre entretien dans {remaining_label}"
                content = (
                    f"Bonjour {candidate_name},\n\n"
                    f"Rappel : votre entretien est prévu dans {remaining_label}.\n\n"
                    f"Date  : {date_str} (Heure locale)\n"
                    f"Heure : {time_str}\n"
                    f"Type  : {interview.get('type', 'Appel Vidéo')}\n\n"
                    f"Connectez-vous à votre espace HumatiQ pour plus de détails.\n\n"
                    f"Cordialement,\nL'équipe HumatiQ"
                )
            await send_email(to_email=candidate_email, subject=subject, content=content)
        except Exception as exc:
            print(f"[Scheduler] Email error: {exc}")

async def _check_and_send_reminders() -> None:
    """Single pass with narrow high-precision windows (+/- 2 min)."""
    db = get_db()
    now = datetime.utcnow()

    # Narrow windows for high precision
    # 24h: [23h58, 24h02]
    # 1h: [58m, 1h02m]
    # 5m: [3m, 7m]
    
    try:
        interviews = list(db.hr_interviews.find({"status": "scheduled"}))
    except Exception as exc:
        print(f"[Scheduler] DB error: {exc}")
        return

    for interview in interviews:
        iid = interview["_id"]
        start: datetime = interview.get("start_time")
        if not start: continue
        
        diff_mins = (start - now).total_seconds() / 60

        # ── 5 m reminder (3m to 7m) ──────────────────────────────────────────
        if not interview.get("reminder_5m_sent") and 3 <= diff_mins <= 7:
            await _send_reminder(interview, "5m")
            # In-app notification logic...
            app_id = interview.get("application_id")
            if app_id:
                try:
                    app_doc = db.job_applications.find_one({"_id": ObjectId(app_id)})
                    if app_doc:
                        candidate_id = app_doc.get("candidate_id") or app_doc.get("user_id")
                        if candidate_id:
                            async_db = get_async_db()
                            await create_notification(
                                async_db, user_id=str(candidate_id),
                                title="Entretien imminent",
                                message=f"Votre entretien commence dans environ 5 minutes.",
                                category="interview", notification_type="info",
                                link=f"/candidat/interviews/room/{iid}"
                            )
                except: pass
            db.hr_interviews.update_one({"_id": iid}, {"$set": {"reminder_5m_sent": True}})

        # ── 1 h reminder (58m to 62m) ────────────────────────────────────────
        if not interview.get("reminder_1h_sent") and 58 <= diff_mins <= 62:
            await _send_reminder(interview, "1h")
            db.hr_interviews.update_one({"_id": iid}, {"$set": {"reminder_1h_sent": True}})

        # ── 24 h reminder (1438m to 1442m) ───────────────────────────────────
        if not interview.get("reminder_24h_sent") and 1438 <= diff_mins <= 1442:
            await _send_reminder(interview, "24h")
            db.hr_interviews.update_one({"_id": iid}, {"$set": {"reminder_24h_sent": True}})

        # ── 🕰️ Missed Interview Detection (diff_mins < -60) ──────────────────
        # If the interview was supposed to start > 60m ago and still 'scheduled'
        # mark it as missed and notify the candidate to reschedule.
        if diff_mins < -60:
            db.hr_interviews.update_one({"_id": iid}, {"$set": {"status": "missed"}})
            app_id = interview.get("application_id")
            if app_id:
                try:
                    app_doc = db.job_applications.find_one({"_id": ObjectId(app_id)})
                    candidate_id = app_doc.get("candidate_id") or app_doc.get("user_id")
                    if candidate_id:
                        async_db = get_async_db()
                        await create_notification(
                            async_db, user_id=str(candidate_id),
                            title="Entretien manqué",
                            message="Vous avez manqué votre entretien. Veuillez contacter le recruteur ou reprogrammer.",
                            category="interview", notification_type="warning",
                            link=f"/candidat/dashboard/my-submissions"
                        )
                except: pass


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
