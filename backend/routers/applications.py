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


def serialize(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serialisable dict."""
    doc["_id"] = str(doc["_id"])
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


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

    # 3. Get candidate profile snapshot
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
    
    # 4. Create application
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
        hr_cursor = db.hr_profiles.find({"company_id": job.get("company_id"), "role": "hr"})
        hr_members = await hr_cursor.to_list(length=10)
        for hr in hr_members:
            await create_notification(
                db,
                user_id=str(hr["_id"]),
                title="Nouvelle Candidature",
                message=f"Un nouveau candidat a postulé pour le poste de {job.get('title')}.",
                category="application",
                notification_type="info",
                link=f"/hr/applications/{new_app['_id']}"
            )
    except Exception as e:
        # Don't fail the application if notification fails
        print(f"Failed to trigger HR notification: {e}")

    return new_app


# ── GET my applications ────────────────────────────────────────────────────
@router.get("/my-applications")
async def get_my_applications(current_user: dict = Depends(get_current_user)):
    import traceback
    try:
        db = get_async_db()
        
        pipeline = [
            {"$match": {"candidate_id": current_user["id"]}},
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
                    "company_logo": {"$ifNull": ["$company_info.logo_url", "https://placeholder.pics/svg/200"]}
                }
            },
            {
                "$project": {
                    "job_oid": 0,
                    "job_info": 0,
                    "company_oid": 0,
                    "company_info": 0,
                    "profile_snapshot": 0
                }
            }
        ]
        
        cursor = db.job_applications.aggregate(pipeline)
        apps = await cursor.to_list(length=100)
        for app in apps:
            app["_id"] = str(app["_id"])
            # Convert any remaining ObjectId/datetime fields
            for k, v in list(app.items()):
                if isinstance(v, ObjectId):
                    app[k] = str(v)
                elif isinstance(v, datetime):
                    app[k] = v.isoformat()
        return apps
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
    final_apps = []
    for app in applications_list:
        # Enrich with candidate info when available
        app = serialize(app)
        candidate_id = app.get("candidate_id") or app.get("user_id")
        if candidate_id:
            candidate = await db.candidates.find_one({"user_id": candidate_id})
            if not candidate and ObjectId.is_valid(candidate_id):
                candidate = await db.candidates.find_one({"_id": ObjectId(candidate_id)})
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
        title = "notif.application.reviewed.title" if new_status == "reviewed" else "Mise à jour de votre candidature"
        message = "notif.application.reviewed.message" if new_status == "reviewed" else f"Le statut de votre candidature est passé à : {new_status}."
        
        await create_notification(
            db,
            user_id=str(app["candidate_id"]),
            title=title,
            message=message,
            category="application",
            notification_type="info",
            link="/candidat/applications"
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
