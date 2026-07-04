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
import os
from datetime import datetime, timedelta
from database.mongodb import connect_mongodb
from bson import ObjectId
from pymongo import ReturnDocument
from utils.email import send_email
from database.mongodb_async import get_async_db
from utils.notifications import create_notification
from utils.interview_no_show import mark_interview_no_show
from services.job_automation import (
    automation_uses_deadline_trigger,
    finalize_quiz_stage_for_job,
    resolve_job_deadline,
    resolve_quiz_stage_deadline,
    run_deadline_automation_for_job,
)


def get_db():
    """Get the HumatiQ MongoDB database handle."""
    client = connect_mongodb()
    if not client:
        raise RuntimeError("Cannot connect to MongoDB")
    return client["HumatiQ"]


def _hr_joined(interview: dict) -> bool:
    return bool(interview.get("hr_joined_at") or interview.get("started_at"))


def _candidate_joined(interview: dict) -> bool:
    if interview.get("candidate_joined_at"):
        return True
    transcript = interview.get("transcript") or []
    if any(entry.get("sender") == "Candidat" for entry in transcript if isinstance(entry, dict)):
        return True
    return bool(interview.get("candidate_analysis_log"))


async def _send_reminder(interview: dict, window: str) -> None:
    """Send reminder emails with localized time and accurate remaining duration."""
    db = get_db()
    candidate_name = interview.get("candidate_name", "Candidat")
    candidate_email = interview.get("candidate_email")
    start_time_local: datetime = interview["start_time"]
    
    # Time is already saved as naive local time by the frontend (no Z)
    date_str = start_time_local.strftime("%A %d %B %Y")
    time_str = start_time_local.strftime("%H:%M")
    
    # Calculate real human-readable remaining time
    now_local = datetime.utcnow() + timedelta(hours=1)
    diff = start_time_local - now_local
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
                frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
                link = f"{frontend_url}/candidat/interviews/room/{interview_id}"
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
    # Datetimes in DB are naive local times (GMT+1).
    now = datetime.utcnow() + timedelta(hours=1)

    # Narrow windows for high precision
    # 24h: [23h58, 24h02]
    # 1h: [58m, 1h02m]
    # 5m: [3m, 7m]
    
    try:
        # Fetch scheduled AND in_progress interviews for reminder/missed checks
        interviews = list(db.hr_interviews.find({"status": {"$in": ["scheduled", "in_progress"]}}))
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
                                message="Votre entretien commence dans environ 5 minutes.",
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

        # ── Missed Interview Detection ────────────────────────────────────────
        # Trigger as soon as end_time is past (not 60 min after start).
        # Uses a flag 'missed_notified' to prevent repeated notifications.
        grace_passed = now >= start + timedelta(minutes=15)
        if (
            grace_passed
            and not interview.get("no_show_marked_at")
            and interview["status"] in ("scheduled", "in_progress")
        ):
            try:
                async_db = get_async_db()
                if not _hr_joined(interview):
                    await mark_interview_no_show(db, async_db, interview, "hr", source="scheduler")
                    continue
                if not _candidate_joined(interview):
                    await mark_interview_no_show(db, async_db, interview, "candidate", source="scheduler")
                    continue
            except Exception as exc:
                print(f"[Scheduler] Error processing no-show {iid}: {exc}")

        end_dt: datetime = interview.get("end_time")
        is_past_end = end_dt and now > end_dt
        already_notified = interview.get("missed_notified", False)

        if is_past_end and not already_notified and interview["status"] in ("scheduled", "in_progress"):
            # Mark interview as missed + set flag
            db.hr_interviews.update_one(
                {"_id": iid},
                {"$set": {"status": "missed", "missed_notified": True}}
            )
            app_id = interview.get("application_id")
            if app_id:
                try:
                    app_doc = db.job_applications.find_one({"_id": ObjectId(app_id)})
                    if app_doc:
                        # Update application interview_status too
                        db.job_applications.update_one(
                            {"_id": ObjectId(app_id)},
                            {"$set": {"interview_status": "missed"}}
                        )

                        async_db = get_async_db()

                        # Notify candidate
                        candidate_id = app_doc.get("candidate_id") or app_doc.get("user_id")
                        if candidate_id:
                            await create_notification(
                                async_db, user_id=str(candidate_id),
                                title="Entretien manqué",
                                message="Votre entretien prévu vient d'expirer. Veuillez contacter le recruteur pour le reprogrammer.",
                                category="interview", notification_type="warning",
                                link="/candidat/dashboard/my-submissions"
                            )

                        # Notify recruiter (in-app + email)
                        recruiter_id = interview.get("recruiter_id")
                        if recruiter_id:
                            await create_notification(
                                async_db, user_id=str(recruiter_id),
                                title="Entretien manqué",
                                message=f"L'entretien avec {interview.get('candidate_name', 'le candidat')} n'a pas eu lieu. Veuillez reprogrammer.",
                                category="interview", notification_type="warning",
                                link=f"/hr/applications/{app_id}"
                            )
                            # Send recruiter email
                            try:
                                recruiter_profile = db.hr_profiles.find_one({"_id": ObjectId(recruiter_id)}) if ObjectId.is_valid(str(recruiter_id)) else None
                                if recruiter_profile and recruiter_profile.get("email"):
                                    local_time = end_dt.strftime("%A %d %B à %H:%M")
                                    await send_email(
                                        to_email=recruiter_profile["email"],
                                        subject=f"Entretien manqué - {interview.get('candidate_name', 'Candidat')}",
                                        content=(
                                            f"Bonjour,\n\n"
                                            f"L'entretien prévu avec {interview.get('candidate_name', 'le candidat')} le {local_time} n'a pas eu lieu.\n\n"
                                            f"Veuillez reprogrammer un nouvel entretien depuis votre tableau de bord HumatiQ.\n\n"
                                            f"Cordialement,\nL'équipe HumatiQ"
                                        )
                                    )
                            except Exception as mail_err:
                                print(f"[Scheduler] Recruiter email error: {mail_err}")
                except Exception as exc:
                    print(f"[Scheduler] Error processing missed interview {iid}: {exc}")


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


async def _check_job_deadlines() -> None:
    """
    Check for jobs whose application deadline has passed and launch the
    configured automated hiring funnel exactly once per phase.
    """
    db = get_async_db()
    now = datetime.now()

    try:
        # On récupère tous les jobs publiés pour vérifier l'expiration et l'automatisation
        jobs_to_process = await db.hr_jobs.find({"status": "published"}).to_list(length=500)

        for job in jobs_to_process:
            job_id = job.get("_id")
            job_title = job.get("title", "Untitled")
            job_deadline = resolve_job_deadline(job)
            quiz_stage_deadline = resolve_quiz_stage_deadline(job)
            quiz_stage = ((job.get("ai_automation") or {}).get("quiz_stage") or {})
            quiz_stage_enabled = bool(quiz_stage.get("enabled")) and bool(quiz_stage.get("quizzes"))

            # ── 1. Vérification d'Expiration (48h avant) ──
            if job_deadline and not job.get("expiration_notified"):
                diff_hours = (job_deadline - now).total_seconds() / 3600
                if 0 < diff_hours <= 48:
                    try:
                        hr_cursor = db.hr_profiles.find({"company_id": job.get("company_id"), "role": "hr"})
                        hr_members = await hr_cursor.to_list(length=10)
                        for hr in hr_members:
                            await create_notification(
                                db,
                                user_id=str(hr["_id"]),
                                title="Expiration d'offre imminente",
                                message=f"L'annonce pour le poste de {job_title} expire dans moins de 48h. Souhaitez-vous la prolonger ?",
                                category="system",
                                notification_type="warning",
                                link="/hr/offres",
                                toggle_key="offerExpiration"
                            )
                        # Marquer pour ne pas spammer
                        await db.hr_jobs.update_one({"_id": job_id}, {"$set": {"expiration_notified": True}})
                    except Exception as e:
                        print(f"Failed to send expiration notification: {e}")

            # ── 2. Lancement Automation IA ──
            if (
                job.get("ai_automation", {}).get("enabled")
                and automation_uses_deadline_trigger(job)
                and job_deadline
                and now >= job_deadline
                and not job.get("deadline_processed")
                and not job.get("deadline_processing")
            ):
                run_id = job.get("ai_automation_run_id") or f"deadline-{job_id}-{int(now.timestamp())}"
                claimed_job = await db.hr_jobs.find_one_and_update(
                    {
                        "_id": job_id,
                        "deadline_processed": {"$ne": True},
                        "deadline_processing": {"$ne": True},
                    },
                    {
                        "$set": {
                            "deadline_processing": True,
                            "deadline_processing_started_at": now,
                            "ai_automation_run_id": run_id,
                        },
                        "$unset": {"deadline_last_error": ""},
                    },
                    return_document=ReturnDocument.AFTER,
                )

                if claimed_job:
                    print(f"[Job Deadline] Launching AI funnel for job {job_id} ({job_title})")
                    try:
                        result = await run_deadline_automation_for_job(db, claimed_job, now=now)
                        summary = {
                            "run_id": result.get("run_id"),
                            "applications_considered": result.get("applications_considered", 0),
                            "vector_shortlist_count": result.get("vector_shortlist_count", 0),
                            "ai_shortlist_count": result.get("ai_shortlist_count", 0),
                            "quizzes_published": result.get("quizzes_published", 0),
                            "promoted_to_interview": result.get("promoted_to_interview", []),
                        }

                        update_doc = {
                            "deadline_processed": True,
                            "deadline_processing": False,
                            "deadline_processed_at": now,
                            "ai_automation_run_id": result.get("run_id"),
                            "ai_automation_summary": summary,
                            "updated_at": datetime.utcnow(),
                            "allow_hr": True,  # Grant HR access after AI automation reaches quiz stage
                        }

                        if not quiz_stage_enabled or result.get("quizzes_published", 0) == 0:
                            update_doc["quiz_stage_processed"] = True
                            update_doc["quiz_stage_processed_at"] = now

                        await db.hr_jobs.update_one({"_id": job_id}, {"$set": update_doc})
                        print(f"[Job Deadline] AI funnel completed for job {job_id}")
                    except Exception as exc:
                        await db.hr_jobs.update_one(
                            {"_id": job_id},
                            {
                                "$set": {
                                    "deadline_processing": False,
                                    "deadline_last_error": str(exc),
                                    "deadline_last_error_at": now,
                                }
                            },
                        )
                        print(f"[Job Deadline] Failed to process job {job_id}: {exc}")
                    continue

            if (
                quiz_stage_enabled
                and job.get("deadline_processed")
                and not job.get("quiz_stage_processed")
                and not job.get("quiz_stage_processing")
                and quiz_stage_deadline
                and now >= quiz_stage_deadline
            ):
                claimed_job = await db.hr_jobs.find_one_and_update(
                    {
                        "_id": job_id,
                        "deadline_processed": True,
                        "quiz_stage_processed": {"$ne": True},
                        "quiz_stage_processing": {"$ne": True},
                    },
                    {
                        "$set": {
                            "quiz_stage_processing": True,
                            "quiz_stage_processing_started_at": now,
                        },
                        "$unset": {"quiz_stage_last_error": ""},
                    },
                    return_document=ReturnDocument.AFTER,
                )

                if claimed_job:
                    print(f"[Job Deadline] Finalizing quiz stage for job {job_id} ({job_title})")
                    try:
                        result = await finalize_quiz_stage_for_job(db, claimed_job, now=now)
                        await db.hr_jobs.update_one(
                            {"_id": job_id},
                            {
                                "$set": {
                                    "quiz_stage_processed": True,
                                    "quiz_stage_processing": False,
                                    "quiz_stage_processed_at": now,
                                    "ai_automation_summary.quiz_stage_finalized_at": now,
                                    "ai_automation_summary.promoted_to_interview": result.get("promoted_to_interview", []),
                                    "updated_at": datetime.utcnow(),
                                }
                            },
                        )
                        print(f"[Job Deadline] Quiz stage finalized for job {job_id}")
                    except Exception as exc:
                        await db.hr_jobs.update_one(
                            {"_id": job_id},
                            {
                                "$set": {
                                    "quiz_stage_processing": False,
                                    "quiz_stage_last_error": str(exc),
                                    "quiz_stage_last_error_at": now,
                                }
                            },
                        )
                        print(f"[Job Deadline] Failed to finalize quiz stage for job {job_id}: {exc}")
    except Exception as exc:
        print(f"[Job Deadline Scheduler] Error checking job deadlines: {exc}")


async def start_job_deadline_scheduler(interval_seconds: int = 60) -> None:
    """
    Infinite async loop that checks for job deadlines.
    interval_seconds defaults to 60 (every 1 minute).
    Call this inside the FastAPI lifespan as an asyncio.Task.
    """
    print(f"[Job Deadline Scheduler] Started (interval={interval_seconds}s)")
    while True:
        print("Checking job deadlines...")
        try:
            await _check_job_deadlines()
        except Exception as exc:
            print(f"[Job Deadline Scheduler] Unexpected error: {exc}")
        await asyncio.sleep(interval_seconds)


async def _check_and_send_weekly_reports() -> None:
    """Génère et envoie le rapport hebdomadaire aux RH chaque vendredi."""
    db = get_async_db()
    now = datetime.now()
    
    # Vérifie si c'est Vendredi (4) et qu'il est environ 17h (17:00 -> 18:00)
    if now.weekday() != 4 or not (17 <= now.hour < 18):
        return

    try:
        # On récupère les profils RH
        hr_profiles = await db.hr_profiles.find({"role": "hr"}).to_list(length=500)
        
        for hr in hr_profiles:
            # Vérifier la préférence
            prefs = hr.get("preferences", {}).get("notifications", {})
            if prefs.get("reports") is False:
                continue
                
            # Vérifier si on a déjà envoyé cette semaine
            last_sent = hr.get("last_weekly_report_sent_at")
            if last_sent and (now - last_sent).days < 6:
                continue
                
            company_id = hr.get("company_id")
            if not company_id:
                continue
            
            # ── Calcul des KPIs sur les 7 derniers jours ──
            seven_days_ago = now - timedelta(days=7)
            
            # 1. Nouvelles candidatures
            jobs = await db.hr_jobs.find({"company_id": str(company_id)}).to_list(length=500)
            job_ids = [str(j["_id"]) for j in jobs]
            
            new_apps_count = await db.job_applications.count_documents({
                "job_id": {"$in": job_ids},
                "applied_at": {"$gte": seven_days_ago}
            })
            
            # 2. Score IA moyen
            apps_evaluated = await db.job_applications.find({
                "job_id": {"$in": job_ids},
                "ai_evaluated_at": {"$gte": seven_days_ago},
                "ai_score": {"$gt": 0}
            }, {"ai_score": 1}).to_list(length=1000)
            
            avg_ai_score = 0
            if apps_evaluated:
                avg_ai_score = sum(app.get("ai_score", 0) for app in apps_evaluated) / len(apps_evaluated)
                avg_ai_score = round(avg_ai_score)
                
            # 3. Entretiens planifiés
            apps = await db.job_applications.find({"job_id": {"$in": job_ids}}, {"_id": 1}).to_list(length=1000)
            app_ids = [str(a["_id"]) for a in apps]
            
            interviews_count = await db.hr_interviews.count_documents({
                "application_id": {"$in": app_ids},
                "created_at": {"$gte": seven_days_ago}
            })
            
            # Générer la notification
            await create_notification(
                db,
                user_id=str(hr["_id"]),
                title="📊 Votre rapport hebdomadaire",
                message=f"Cette semaine : {new_apps_count} candidatures et {interviews_count} entretiens générés. Score IA moyen : {avg_ai_score}%.",
                category="system",
                notification_type="info",
                link="/hr/dashboard",
                toggle_key="reports"
            )
            
            # Marquer comme envoyé
            await db.hr_profiles.update_one(
                {"_id": hr["_id"]},
                {"$set": {"last_weekly_report_sent_at": now}}
            )
            
    except Exception as exc:
        print(f"[Weekly Report Scheduler] Error: {exc}")


async def start_weekly_report_scheduler(interval_seconds: int = 3600) -> None:
    """Vérifie périodiquement si on doit envoyer le rapport."""
    print(f"[Weekly Report Scheduler] Started (interval={interval_seconds}s)")
    while True:
        try:
            await _check_and_send_weekly_reports()
        except Exception as exc:
            print(f"[Weekly Report Scheduler] Unexpected error: {exc}")
        await asyncio.sleep(interval_seconds)
