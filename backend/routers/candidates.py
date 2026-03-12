from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user

router = APIRouter(prefix="/candidates", tags=["HR Candidates"])

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
        candidate = None
        if ObjectId.is_valid(candidate_id):
            candidate = db.candidates.find_one({"_id": ObjectId(candidate_id)})
        if not candidate:
            candidate = db.candidates.find_one({"user_id": candidate_id})
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        c_id = candidate.get("user_id") or str(candidate.get("_id"))
        
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
                "job_id": str(app.get("job_id", "")),
                "job_title": job_title,
                "ai_score": app.get("ai_score", 0),
                "ai_justification": app.get("ai_justification", ""),
                "status": app.get("status", "pending"),
                "created_at": str(app.get("created_at", "")),
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
        }
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
