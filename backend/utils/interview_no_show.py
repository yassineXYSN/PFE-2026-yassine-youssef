from datetime import datetime
from typing import Any, Dict, Optional

from bson import ObjectId

from utils.email import send_email
from utils.notifications import create_notification


NO_SHOW_FAULTS = {"hr", "candidate"}


def _id_filter(value: Any) -> Dict[str, Any]:
    value_str = str(value)
    if ObjectId.is_valid(value_str):
        return {"_id": ObjectId(value_str)}
    return {"_id": value}


def _find_profile(db, user_id: Optional[Any]) -> Optional[dict]:
    if not user_id:
        return None
    user_id_str = str(user_id)
    profile = db.hr_profiles.find_one({"_id": user_id_str})
    if profile:
        return profile
    if ObjectId.is_valid(user_id_str):
        return db.hr_profiles.find_one({"_id": ObjectId(user_id_str)})
    return None


async def mark_interview_no_show(
    db,
    async_db,
    interview: dict,
    fault: str,
    *,
    marked_by: Optional[Any] = None,
    source: str = "manual",
) -> dict:
    """Persist a 15-minute no-show decision and notify the affected users."""
    if fault not in NO_SHOW_FAULTS:
        raise ValueError("fault must be 'hr' or 'candidate'")

    now = datetime.utcnow()
    interview_id = interview["_id"]
    app_id = interview.get("application_id")
    recruiter_id = interview.get("recruiter_id")
    reschedule_required = fault == "hr"
    app_status = "hr_no_show" if fault == "hr" else "candidate_no_show"

    interview_update = {
        "status": "no_show",
        "no_show_fault": fault,
        "no_show_marked_at": now,
        "no_show_marked_by": str(marked_by) if marked_by else None,
        "no_show_source": source,
        "reschedule_required": reschedule_required,
        "missed_notified": True,
    }
    db.hr_interviews.update_one(
        {"_id": interview_id},
        {"$set": interview_update},
    )

    app_doc = None
    if app_id:
        app_doc = db.job_applications.find_one(_id_filter(app_id))
        app_update = {
            "interview_status": app_status,
            "interview_no_show_fault": fault,
            "interview_no_show_marked_at": now,
            "interview_reschedule_required": reschedule_required,
        }
        db.job_applications.update_one(_id_filter(app_id), {"$set": app_update})

    candidate_id = (app_doc.get("candidate_id") or app_doc.get("user_id")) if app_doc else None
    candidate_name = interview.get("candidate_name", "le candidat")
    link_hr = f"/hr/applications/{app_id}" if app_id else "/hr/dashboard"

    if fault == "hr":
        candidate_title = "Entretien a reprogrammer"
        candidate_message = (
            "Le recruteur n'a pas rejoint votre entretien dans les 15 minutes suivant l'heure prevue. "
            "Un nouvel entretien devra etre organise."
        )
        recruiter_title = "Entretien a reprogrammer"
        recruiter_message = (
            f"Vous n'avez pas rejoint l'entretien avec {candidate_name} dans les 15 minutes. "
            "Veuillez proposer un nouveau creneau."
        )
    else:
        candidate_title = "Absence a l'entretien"
        candidate_message = (
            "Vous n'avez pas rejoint votre entretien dans les 15 minutes suivant l'heure prevue."
        )
        recruiter_title = "Candidat absent"
        recruiter_message = (
            f"{candidate_name} n'a pas rejoint l'entretien dans les 15 minutes. "
            "Vous n'etes pas oblige de reprogrammer."
        )

    if candidate_id:
        try:
            await create_notification(
                async_db,
                user_id=str(candidate_id),
                title=candidate_title,
                message=candidate_message,
                category="interview",
                notification_type="warning",
                link="/candidat/dashboard/my-submissions",
            )
        except Exception as exc:
            print(f"[NoShow] Candidate notification failed: {exc}")

    if recruiter_id:
        try:
            await create_notification(
                async_db,
                user_id=str(recruiter_id),
                title=recruiter_title,
                message=recruiter_message,
                category="interview",
                notification_type="warning",
                link=link_hr,
            )
        except Exception as exc:
            print(f"[NoShow] Recruiter notification failed: {exc}")

        try:
            recruiter_profile = _find_profile(db, recruiter_id)
            recruiter_email = recruiter_profile.get("email") if recruiter_profile else None
            if recruiter_email:
                await send_email(
                    to_email=recruiter_email,
                    subject=recruiter_title,
                    content=(
                        f"Bonjour,\n\n"
                        f"{recruiter_message}\n\n"
                        f"Cordialement,\nL'equipe HumatiQ"
                    ),
                )
        except Exception as exc:
            print(f"[NoShow] Recruiter email failed: {exc}")

    updated = db.hr_interviews.find_one({"_id": interview_id})
    return updated or {**interview, **interview_update}
