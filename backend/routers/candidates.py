from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from utils.files import resolve_file

router = APIRouter(prefix="/candidates", tags=["HR Candidates"])
ALLOWED_RATING_ROLES = {"admin", "recruiter", "chef_departement", "hr"}


class CandidateRatingPayload(BaseModel):
    rate: int = Field(..., ge=1, le=5)

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

def serialize_mongo(obj):
    """Recursively convert ObjectId, datetime, and bytes to string for JSON serialization."""
    if isinstance(obj, list):
        return [serialize_mongo(item) for item in obj]
    if isinstance(obj, dict):
        return {k: serialize_mongo(v) for k, v in obj.items()}
    if isinstance(obj, (ObjectId, datetime)):
        return str(obj)
    if isinstance(obj, bytes):
        # Simply return a placeholder for binary data to avoid bloated JSON
        return "[Binary Data]"
    return obj


def find_candidate_document(db, candidate_id: str):
    candidate = None
    if ObjectId.is_valid(candidate_id):
        candidate = db.candidates.find_one({"_id": ObjectId(candidate_id)})
    if not candidate:
        candidate = db.candidates.find_one({"user_id": candidate_id})
    return candidate


def build_candidate_rating_meta(candidate: dict, current_user_id: Optional[str] = None):
    raw_ratings = candidate.get("ratings", [])
    ratings = raw_ratings if isinstance(raw_ratings, list) else []
    serialized_ratings = serialize_mongo(ratings)

    valid_rates = []
    for rating in ratings:
        try:
            parsed_rate = int(rating.get("rate"))
            if 1 <= parsed_rate <= 5:
                valid_rates.append(parsed_rate)
        except (TypeError, ValueError, AttributeError):
            continue

    current_user_rating = None
    if current_user_id:
        current_user_rating = next(
            (rating for rating in serialized_ratings if rating.get("hr_id") == current_user_id),
            None
        )

    return {
        "ratings": serialized_ratings,
        "ratings_count": len(serialized_ratings),
        "ratings_average": round(sum(valid_rates) / len(valid_rates), 1) if valid_rates else None,
        "current_user_rating": current_user_rating,
    }

@router.get("")
async def get_all_candidates(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Returns all candidate profiles decorated with their best matching job info.
    """
    try:
        db = get_db()
        candidates_cursor = db.candidates.find({}).skip(skip).limit(limit)
        raw_candidates = list(candidates_cursor)
        
        # Enrich candidates with their best match job application
        enriched_candidates = []
        for cand in raw_candidates:
            # Try to find applications by user_id or _id
            candidate_id = cand.get("user_id") or str(cand.get("_id"))
            
            # Find the application with the highest ai_score for this candidate
            # We sort by ai_score descending
            best_app = db.job_applications.find_one(
                {"$or": [{"candidate_id": candidate_id}, {"user_id": candidate_id}]},
                sort=[("ai_score", -1)]
            )
            
            if best_app:
                # Add score (stored as ai_score in applications)
                cand["score"] = best_app.get("ai_score") or best_app.get("score") or 0
                
                # Fetch job title
                job_id = best_app.get("job_id")
                if job_id:
                    from bson import ObjectId
                    job_query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(job_id) else {"_id": job_id}
                    job = db.hr_jobs.find_one(job_query)
                    if job:
                        cand["best_match_job"] = job.get("title") or "Job sans titre"
                    else:
                        cand["best_match_job"] = "Job inconnu"
                else:
                    cand["best_match_job"] = "Non assigné"
            else:
                cand["score"] = 0
                cand["best_match_job"] = "Aucune candidature"
                
            enriched_candidates.append(cand)
            
        return serialize_mongo(enriched_candidates)
    except Exception as e:
        import traceback
        print(f"ERROR in get_all_candidates: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/{candidate_id}")
async def get_candidate_detail(
    candidate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns a single candidate profile enriched with application data,
    skills, experience, and education from their profile snapshots.
    """
    try:
        db = get_db()
        
        # Try to find by ObjectId or user_id string
        candidate = find_candidate_document(db, candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        c_id = candidate.get("user_id") or str(candidate.get("_id"))
        
        # Enrich candidate with base user data (email, phone, real names) if missing
        user = None
        if ObjectId.is_valid(c_id):
            user = db.users.find_one({"_id": ObjectId(c_id)})
        if not user:
            user = db.users.find_one({"id": c_id})
            
        if user:
            candidate["email"] = candidate.get("email") or user.get("email") or ""
            candidate["phone"] = candidate.get("phone") or user.get("phone") or user.get("telephone") or ""
            candidate["firstName"] = candidate.get("firstName") or candidate.get("prenom") or user.get("first_name") or ""
            candidate["lastName"] = candidate.get("lastName") or candidate.get("nom") or user.get("last_name") or ""
            candidate["profileImage"] = candidate.get("profileImage") or candidate.get("profilePicture") or candidate.get("avatar") or user.get("profileImage") or ""

        
        # Find all applications by this candidate (sorted best score first)
        applications = list(db.candidat_applications.find(
            {"$or": [{"candidate_id": c_id}, {"user_id": c_id}]}
        ).sort("ai_score", -1))
        
        # Also check legacy collection
        if not applications:
            applications = list(db.job_applications.find(
                {"$or": [{"candidate_id": c_id}, {"user_id": c_id}]}
            ).sort("ai_score", -1))
        
        # Build enriched application list with job title
        enriched_apps = []
        for app in applications:
            job_id = app.get("job_id")
            job_title = "Inconnu"
            if job_id:
                job_query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(str(job_id)) else {"_id": job_id}
                job = db.hr_jobs.find_one(job_query)
                if job:
                    job_title = job.get("title", "Inconnu")
            enriched_apps.append({
                "application_id": str(app.get("_id", "")),
                "job_id": str(app.get("job_id", "")),
                "job_title": job_title,
                "ai_score": app.get("ai_score", 0),
                "ai_justification": app.get("ai_justification", ""),
                "status": app.get("status", "pending"),
                "created_at": str(app.get("created_at", "")),
                "updated_at": str(app.get("updated_at", "")),
                "skills": app.get("profile_snapshot", {}).get("skills", []) or candidate.get("skills", []),
                "experiences": app.get("profile_snapshot", {}).get("experiences", []) or candidate.get("experiences", []),
                "educations": app.get("profile_snapshot", {}).get("educations", []) or candidate.get("educations", []),
            })
        
        # Get best app info for the overview
        best_app = enriched_apps[0] if enriched_apps else None
        
        result = {
            **serialize_mongo(candidate),
            "applications": serialize_mongo(enriched_apps),
            "best_score": best_app["ai_score"] if best_app else 0,
            "best_match_job": best_app["job_title"] if best_app else "Aucune candidature",
            "ai_justification": best_app["ai_justification"] if best_app else "",
            # Use profile snapshot skills/exp if candidate doc doesn't have them
            "skills": serialize_mongo(best_app["skills"] if best_app else candidate.get("skills", [])),
            "experiences": serialize_mongo(best_app["experiences"] if best_app else candidate.get("experiences", [])),
            "educations": serialize_mongo(best_app["educations"] if best_app else candidate.get("educations", [])),
            **build_candidate_rating_meta(candidate, current_user.get("id")),
        }
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{candidate_id}/rating")
async def upsert_candidate_rating(
    candidate_id: str,
    payload: CandidateRatingPayload,
    current_user: dict = Depends(get_current_user)
):
    """
    Save or update the current HR user's rating for a candidate.
    A single HR can rate the same candidate only once, but can change that rating later.
    """
    try:
        if current_user.get("role") not in ALLOWED_RATING_ROLES:
            raise HTTPException(status_code=403, detail="You are not allowed to rate candidates")

        db = get_db()
        candidate = find_candidate_document(db, candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        hr_profile = db.hr_profiles.find_one({"_id": current_user["id"]}) or {}
        hr_first_name = hr_profile.get("first_name") or hr_profile.get("firstName") or ""
        hr_last_name = hr_profile.get("last_name") or hr_profile.get("lastName") or ""
        hr_name = f"{hr_first_name} {hr_last_name}".strip() or current_user.get("email") or "HR"

        ratings = candidate.get("ratings", [])
        ratings = ratings if isinstance(ratings, list) else []
        now = datetime.utcnow()

        new_rating = {
            "hr_id": current_user["id"],
            "hr_email": current_user.get("email", ""),
            "hr_name": hr_name,
            "hr_role": current_user.get("role", ""),
            "rate": payload.rate,
            "updated_at": now,
        }

        existing_index = next(
            (index for index, rating in enumerate(ratings) if rating.get("hr_id") == current_user["id"]),
            None
        )

        if existing_index is not None:
            previous_created_at = ratings[existing_index].get("created_at")
            new_rating["created_at"] = previous_created_at or now
            ratings[existing_index] = new_rating
        else:
            new_rating["created_at"] = now
            ratings.append(new_rating)

        db.candidates.update_one(
            {"_id": candidate["_id"]},
            {
                "$set": {
                    "ratings": ratings,
                    "updated_at": now,
                }
            }
        )

        updated_candidate = find_candidate_document(db, candidate_id) or {**candidate, "ratings": ratings}
        return build_candidate_rating_meta(updated_candidate, current_user.get("id"))
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{candidate_id}/cv/download")
async def download_candidate_cv(
    candidate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Download a candidate CV from the HR side.
    """
    try:
        db = get_db()
        candidate = find_candidate_document(db, candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        cv = candidate.get("cv")
        if not cv or not isinstance(cv, dict):
            raise HTTPException(status_code=404, detail="CV not found")

        resolved = resolve_file(cv)
        if resolved:
            abs_path, content_type, filename = resolved
            return FileResponse(abs_path, media_type=content_type, filename=filename)

        if cv.get("file_data"):
            return Response(
                content=bytes(cv["file_data"]),
                media_type=cv.get("content_type", "application/pdf"),
                headers={"Content-Disposition": f'attachment; filename="{cv.get("filename", "cv.pdf")}"'},
            )

        raise HTTPException(status_code=404, detail="CV file not found")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
