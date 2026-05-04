from database.mongodb_async import get_async_db
from middleware.auth import get_current_user
from models.application import JobApplicationBase, JobApplicationCreate
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response
from typing import List, Optional
from utils.files import resolve_file
from utils.notifications import create_notification


router = APIRouter(prefix="/applications", tags=["applications"])

# get_db is deprecated in favor of get_async_db from database.mongodb_async


def serialize_value(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    return value


def serialize(doc: dict) -> dict:
    """Convert MongoDB document to a JSON-serialisable dict."""
    return {key: serialize_value(value) for key, value in doc.items()}


def _parse_sortable_datetime(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value

    if isinstance(value, str):
        candidate = value.strip()
        if candidate.endswith("Z"):
            candidate = candidate[:-1] + "+00:00"

        try:
            parsed = datetime.fromisoformat(candidate)
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except ValueError:
            return None

    return None


def _get_latest_candidate_visible_quiz(quizzes):
    if not quizzes:
        return None

    def sort_key(quiz):
        for field in ("submitted_at", "published_at", "updated_at", "generated_at"):
            parsed = _parse_sortable_datetime(quiz.get(field))
            if parsed:
                return parsed, str(quiz.get("_id", ""))

        return datetime.min, str(quiz.get("_id", ""))

    return max(quizzes, key=sort_key)


def _serialize_candidate_quiz_status(status_value):
    return "sent" if status_value == "published" else status_value


def _candidate_application_lookup_pipeline(candidate_id: str):
    return [
        {"$match": {"candidate_id": candidate_id}},
        {
            "$addFields": {
                "job_oid": {
                    "$cond": {
                        "if": {"$eq": [{"$type": "$job_id"}, "string"]},
                        "then": {
                            "$cond": {
                                "if": {"$eq": [{"$strLenCP": "$job_id"}, 24]},
                                "then": {"$toObjectId": "$job_id"},
                                "else": "$job_id"
                            }
                        },
                        "else": "$job_id"
                    }
                }
            }
        },
        {
            "$lookup": {
                "from": "hr_jobs",
                "localField": "job_oid",
                "foreignField": "_id",
                "as": "job_info"
            }
        },
        {"$unwind": {"path": "$job_info", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "company_oid": {
                    "$cond": {
                        "if": {"$and": [
                            {"$ne": ["$job_info", None]},
                            {"$ne": ["$job_info.company_id", None]},
                            {"$eq": [{"$type": "$job_info.company_id"}, "string"]}
                        ]},
                        "then": {
                            "$cond": {
                                "if": {"$eq": [{"$strLenCP": "$job_info.company_id"}, 24]},
                                "then": {"$toObjectId": "$job_info.company_id"},
                                "else": "$job_info.company_id"
                            }
                        },
                        "else": "$job_info.company_id"
                    }
                }
            }
        },
        {
            "$lookup": {
                "from": "hr_companies",
                "localField": "company_oid",
                "foreignField": "_id",
                "as": "company_info"
            }
        },
        {"$unwind": {"path": "$company_info", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "job_title": "$job_info.title",
                "location": "$job_info.location",
                "salary": "$job_info.salary_range",
                "company_name": {"$ifNull": ["$company_info.name", "HumatiQ Partner"]},
                "company_logo": {"$ifNull": ["$company_info.logo_url", "https://placeholder.pics/svg/200"]},
            }
        },
    ]


def _latest_pending_proposals_by_application(proposals):
    latest_by_application = {}

    for proposal in proposals:
        application_id = str(proposal.get("application_id") or "")
        if not application_id or application_id in latest_by_application:
            continue
        latest_by_application[application_id] = proposal

    return latest_by_application


# ── POST Apply ─────────────────────────────────────────────────────────────
@router.post("/apply", response_model=JobApplicationBase)
async def apply_to_job(
    application: JobApplicationCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "candidat":
        raise HTTPException(status_code=403, detail="Only candidates can apply to jobs")
    
    db = get_async_db()
    
    # 1. Verify job exists
    job = await db.hr_jobs.find_one({"_id": ObjectId(application.job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 2. Check if already applied
    existing_app = await db.job_applications.find_one({
        "candidate_id": current_user["id"],
        "job_id": application.job_id
    })
    if existing_app:
        raise HTTPException(status_code=400, detail="You have already applied to this job")

    # 3. Check for motivation letter requirement
    if job.get("require_motivation_letter", False) and not application.motivation_letter:
        raise HTTPException(status_code=400, detail="A motivation letter is required for this job")

    # 4. Get candidate profile snapshot
    profile = await db.candidates.find_one({"user_id": current_user["id"]})
    if not profile:
        profile = await db.hr_profiles.find_one({"_id": current_user["id"]})
        
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    
    # Define exact fields to include in snapshot
    whitelist = [
        "certificates", "created_at", "cv", "educations", 
        "experiences", "firstName", "hobbies", "jobPreferences", 
        "languages", "lastName", "skills", "title", "about"
    ]
    
    snapshot = {field: profile.get(field) for field in whitelist if field in profile}
    
    # 5. Create application
    new_app = {
        "candidate_id": current_user["id"],
        "job_id": application.job_id,
        "motivation_letter": application.motivation_letter,
        "status": "new",
        "profile_snapshot": snapshot,
        "applied_at": datetime.utcnow()
    }
    
    result = await db.job_applications.insert_one(new_app)
    new_app["_id"] = str(result.inserted_id)
    
    # Trigger Notification for HR (all HR members of the company)
    try:
        from utils.notifications import create_notification
        
        company = await db.hr_companies.find_one({"_id": ObjectId(job.get("company_id"))}) if job.get("company_id") else None
        c_name = company.get("name", "") if company else ""
        j_title = job.get("title", "") if job else ""

        hr_cursor = db.hr_profiles.find({"company_id": job.get("company_id"), "role": "hr"})
        hr_members = await hr_cursor.to_list(length=10)
        for hr in hr_members:
            await create_notification(
                db,
                user_id=str(hr["_id"]),
                title="Nouvelle Candidature",
                message=f"Un nouveau candidat a postulé pour le poste de {j_title}.",
                category="application",
                notification_type="info",
                link=f"/rh/dashboard/applications/{new_app['_id']}",
                metadata={"company_name": c_name, "job_title": j_title},
                toggle_key="newCandidates"
            )
    except Exception as e:
        # Don't fail the application if notification fails
        print(f"Failed to trigger HR notification: {e}")

    return new_app


@router.get("/dashboard-summary")
async def get_candidate_dashboard_summary(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "candidat":
        raise HTTPException(status_code=403, detail="Only candidates can access this endpoint")

    db = get_async_db()

    pipeline = _candidate_application_lookup_pipeline(current_user["id"]) + [
        {
            "$project": {
                "job_oid": 0,
                "job_info": 0,
                "company_oid": 0,
                "company_info": 0,
                "profile_snapshot": 0,
                "motivation_letter": 0,
            }
        }
    ]

    raw_apps = await db.job_applications.aggregate(pipeline).to_list(length=200)
    apps = [serialize(app) for app in raw_apps]

    app_by_id = {app["_id"]: app for app in apps}
    interviews = []

    if app_by_id:
        raw_interviews = await db.hr_interviews.find(
            {"application_id": {"$in": list(app_by_id.keys())}},
            projection={
                "_id": 1,
                "application_id": 1,
                "start_time": 1,
                "end_time": 1,
                "status": 1,
                "type": 1,
                "meeting_link": 1,
            },
        ).sort("start_time", 1).to_list(length=200)

        for interview in raw_interviews:
            payload = serialize(interview)
            app = app_by_id.get(payload.get("application_id"), {})
            payload["job_title"] = app.get("job_title")
            payload["company_name"] = app.get("company_name")
            interviews.append(payload)

    return {
        "applications": apps,
        "interviews": interviews,
    }


# ── GET my applications ────────────────────────────────────────────────────
@router.get("/my-applications")
async def get_my_applications(current_user: dict = Depends(get_current_user)):
    import traceback
    try:
        db = get_async_db()
        
        pipeline = _candidate_application_lookup_pipeline(current_user["id"]) + [
            {
                "$addFields": {
                    "interview_oid": {
                        "$cond": {
                            "if": {"$and": [
                                {"$ne": ["$interview_id", None]},
                                {"$eq": [{"$type": "$interview_id"}, "string"]},
                                {"$eq": [{"$strLenCP": "$interview_id"}, 24]}
                            ]},
                            "then": {"$toObjectId": "$interview_id"},
                            "else": "$interview_id"
                        }
                    }
                }
            },
            {
                "$lookup": {
                    "from": "hr_interviews",
                    "localField": "interview_oid",
                    "foreignField": "_id",
                    "as": "interview_info"
                }
            },
            {"$unwind": {"path": "$interview_info", "preserveNullAndEmptyArrays": True}},
            {
                "$addFields": {
                    "interview_start_time": "$interview_info.start_time",
                    "interview_end_time": "$interview_info.end_time"
                }
            },
            {
                "$project": {
                    "job_oid": 0,
                    "job_info": 0,
                    "company_oid": 0,
                    "company_info": 0,
                    "interview_oid": 0,
                    "interview_info": 0,
                    "profile_snapshot": 0
                }
            }
        ]

        raw_apps = await db.job_applications.aggregate(pipeline).to_list(length=100)
        apps = [serialize(app) for app in raw_apps]
        enriched_apps = []

        application_ids = [app["_id"] for app in apps]
        interview_ids = [
            ObjectId(str(app["interview_id"]))
            for app in apps
            if app.get("interview_id") and ObjectId.is_valid(str(app["interview_id"]))
        ]
        proposal_application_ids = [
            app["_id"]
            for app in apps
            if app.get("interview_status") == "pending_candidate"
        ]

        quiz_map = {}
        if application_ids:
            quizzes = await db.quizzes.find(
                {
                    "application_id": {"$in": application_ids},
                    "status": {"$in": ["published", "completed"]},
                },
                projection={
                    "_id": 1,
                    "application_id": 1,
                    "status": 1,
                    "generated_at": 1,
                    "updated_at": 1,
                    "published_at": 1,
                    "submitted_at": 1,
                    "deadline": 1,
                },
            ).to_list(length=max(len(application_ids) * 10, 200))

            quizzes_by_application = {}
            for quiz in quizzes:
                application_id = str(quiz.get("application_id") or "")
                if not application_id:
                    continue
                quizzes_by_application.setdefault(application_id, []).append(quiz)

            quiz_map = {
                application_id: _get_latest_candidate_visible_quiz(items)
                for application_id, items in quizzes_by_application.items()
            }

        interview_map = {}
        if interview_ids:
            interviews = await db.hr_interviews.find(
                {"_id": {"$in": interview_ids}},
                projection={
                    "_id": 1,
                    "start_time": 1,
                    "end_time": 1,
                    "type": 1,
                    "status": 1,
                    "meeting_link": 1,
                },
            ).to_list(length=len(interview_ids))
            interview_map = {
                str(interview["_id"]): serialize(interview)
                for interview in interviews
            }

        proposal_map = {}
        if proposal_application_ids:
            proposals = await db.hr_interview_proposals.find(
                {
                    "application_id": {"$in": proposal_application_ids},
                    "status": "pending",
                },
                projection={
                    "_id": 1,
                    "application_id": 1,
                    "slots": 1,
                    "duration_minutes": 1,
                    "interview_type": 1,
                    "created_at": 1,
                },
            ).sort([("created_at", -1), ("_id", -1)]).to_list(length=max(len(proposal_application_ids) * 5, 100))
            proposal_map = _latest_pending_proposals_by_application([
                serialize(proposal) for proposal in proposals
            ])

        for app in apps:
            application_id = app["_id"]

            latest_quiz = quiz_map.get(application_id)
            if latest_quiz:
                app["quiz_id"] = str(latest_quiz["_id"])
                app["quiz_status"] = _serialize_candidate_quiz_status(latest_quiz.get("status"))
                deadline = latest_quiz.get("deadline")
                if deadline is not None:
                    app["quiz_deadline"] = deadline.isoformat() if hasattr(deadline, "isoformat") else deadline

            interview_id = app.get("interview_id")
            interview_data = interview_map.get(str(interview_id))
            if interview_data:
                app["interview_details"] = {
                    "start_time": interview_data.get("start_time"),
                    "end_time": interview_data.get("end_time"),
                    "type": interview_data.get("type"),
                    "status": interview_data.get("status"),
                    "meeting_link": interview_data.get("meeting_link"),
                }

            proposal_data = proposal_map.get(application_id)
            if proposal_data:
                proposal_slots = proposal_data.get("slots") or []
                app["interview_proposal"] = {
                    "_id": proposal_data.get("_id"),
                    "slot_count": len(proposal_slots),
                    "next_slot": proposal_slots[0] if proposal_slots else None,
                    "duration_minutes": proposal_data.get("duration_minutes"),
                    "interview_type": proposal_data.get("interview_type"),
                }

            enriched_apps.append(app)

        return enriched_apps
    except Exception as e:
        print(f"ERROR in get_my_applications: {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {type(e).__name__}: {str(e)}")


# ── GET check status ───────────────────────────────────────────────────────
@router.get("/check/{job_id}")
async def check_application_status(job_id: str, current_user: dict = Depends(get_current_user)):
    db = get_async_db()
    existing_app = await db.job_applications.find_one({
        "candidate_id": current_user["id"],
        "job_id": job_id
    })
    return {"applied": existing_app is not None}


# ── GET all applications for a job ─────────────────────────────────────────
@router.get("/job/{job_id}")
async def get_applications_for_job(
    job_id: str,
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Return all candidatures linked to a given job_id."""
    db = get_async_db()
    query: dict = {"job_id": job_id}
    if status_filter:
        query["status"] = status_filter

    cursor = db.job_applications.find(query).skip(skip).limit(limit)
    applications_list = await cursor.to_list(length=limit)
    
    # N+1 Query Optimization: Gather candidate_ids first
    candidate_ids = []
    object_ids = []
    for app in applications_list:
        cid = app.get("candidate_id") or app.get("user_id")
        if cid:
            candidate_ids.append(cid)
            if ObjectId.is_valid(cid):
                object_ids.append(ObjectId(cid))
                
    candidates_pool = {}
    if candidate_ids:
        cand_query = {"$or": [{"user_id": {"$in": candidate_ids}}]}
        if object_ids:
            cand_query["$or"].append({"_id": {"$in": object_ids}})
            
        cands_cursor = db.candidates.find(cand_query)
        all_cands = await cands_cursor.to_list(length=limit)
        for c in all_cands:
            candidates_pool[c.get("user_id")] = c
            candidates_pool[str(c.get("_id"))] = c

    final_apps = []
    for app in applications_list:
        # Enrich with candidate info when available
        app = serialize(app)
        candidate_id = app.get("candidate_id") or app.get("user_id")
        if candidate_id:
            candidate = candidates_pool.get(candidate_id)
            if candidate:
                app["firstName"] = candidate.get("firstName") or candidate.get("prenom") or ""
                app["lastName"] = candidate.get("lastName") or candidate.get("nom") or ""
                app["email"] = candidate.get("email") or ""
                app["avatar"] = candidate.get("avatar") or candidate.get("photo") or None
                app["headline"] = candidate.get("title") or candidate.get("posteActuel") or candidate.get("headline") or ""
        final_apps.append(app)

    return final_apps


# ── GET single application ─────────────────────────────────────────────────
@router.get("/{application_id}")
async def get_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(application_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")
    db = get_async_db()
    app = await db.job_applications.find_one({"_id": ObjectId(application_id)})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return serialize(app)


# ── PATCH status (HR updates candidature status) ───────────────────────────
@router.patch("/{application_id}/status")
async def update_application_status(
    application_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Update the status of an application (e.g. 'pending', 'reviewed', 'accepted', 'rejected')."""
    if not ObjectId.is_valid(application_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="status field required")
    db = get_async_db()
    
    # Fetch application first to get candidate_id
    app = await db.job_applications.find_one({"_id": ObjectId(application_id)})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    result = await db.job_applications.update_one(
        {"_id": ObjectId(application_id)},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}},
    )
    
    # Trigger Notification for Candidate
    try:
        from utils.notifications import create_notification
        
        job = await db.hr_jobs.find_one({"_id": ObjectId(app.get("job_id"))}) if app.get("job_id") else None
        company = await db.hr_companies.find_one({"_id": ObjectId(job.get("company_id"))}) if (job and job.get("company_id")) else None
        
        c_name = company.get("name", "") if company else ""
        j_title = job.get("title", "") if job else ""

        title = "notif.application.reviewed.title" if new_status == "reviewed" else "Mise à jour de votre candidature"
        message = "notif.application.reviewed.message" if new_status == "reviewed" else f"Le statut de votre candidature est passé à : {new_status}."
        
        await create_notification(
            db,
            user_id=str(app["candidate_id"]),
            title=title,
            message=message,
            category="application",
            notification_type="info",
            link="/candidat/dashboard/applications",
            metadata={"company_name": c_name, "job_title": j_title}
        )
    except Exception as e:
        print(f"Failed to trigger Candidate notification: {e}")

    return {"ok": True, "status": new_status}


# ── DELETE ─────────────────────────────────────────────────────────────────
@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(application_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")
    db = get_async_db()
    result = await db.job_applications.delete_one({"_id": ObjectId(application_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    return None


@router.get("/{application_id}/cv")
async def get_application_cv(
    application_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns the CV PDF for a given application.
    Accessible by HR/Admin or the candidate who owns the application.
    """
    if not ObjectId.is_valid(application_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")
    
    db = get_async_db()
    app = await db.job_applications.find_one({"_id": ObjectId(application_id)})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Check permissions (simple check for now: only HR or the owner)
    # current_user is already validated by get_current_user dependency
    if current_user["role"] not in ["hr", "admin"] and current_user["id"] != app.get("candidate_id"):
        raise HTTPException(status_code=403, detail="Not authorized to view this CV")

    profile_snapshot = app.get("profile_snapshot", {})
    cv = profile_snapshot.get("cv")
    
    if not cv:
        raise HTTPException(status_code=404, detail="No CV found in application snapshot")

    # Resolve file using shared utility
    resolved = resolve_file(cv)
    if resolved:
        abs_path, content_type, filename = resolved
        return FileResponse(abs_path, media_type=content_type, filename=filename)

    # Legacy fallback: binary in MongoDB
    if isinstance(cv, dict) and cv.get("file_data"):
        return Response(
            content=bytes(cv["file_data"]),
            media_type=cv.get("content_type", "application/pdf"),
            headers={"Content-Disposition": f'inline; filename="{cv.get("filename", "cv.pdf")}"'}
        )

    raise HTTPException(status_code=404, detail="CV file could not be resolved")


# ── POST Reset (Testing only) ──────────────────────────────────────────────
@router.post("/{application_id}/reset")
async def reset_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Resets application status and all AI analysis for testing purposes.
    """
    if not ObjectId.is_valid(application_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")
    
    db = get_async_db()
    
    result = await db.job_applications.update_one(
        {"_id": ObjectId(application_id)},
        {"$set": {
        "status": "pending",
            "updated_at": datetime.utcnow(),
            "ai_score": 0,
            "ai_justification": None,
            "ai_evaluated_at": None,
            "quiz_status": "pending",
            "quiz_score": 0,
            "quiz_ai_analysis": None,
            "quiz_ai_evaluated_at": None,
            "quiz_completed_at": None,
            "quiz_attempts": 0
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")

    # Optional: Delete associated quizzes to allow fresh generation
    await db.quizzes.delete_many({"application_id": application_id})

    return {"ok": True, "message": "Application reset successfully"}
