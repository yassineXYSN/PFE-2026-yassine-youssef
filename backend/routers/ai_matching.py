from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from database.mongodb_async import get_async_db
from services.ai_matching import AIMatchingService
from middleware.auth import get_current_user
from bson import ObjectId
import json
from datetime import datetime

router = APIRouter(prefix="/ai-matching", tags=["AI Matching"])

def bson_serial(obj):
    if isinstance(obj, (datetime, ObjectId)):
        return str(obj)
    return str(obj)

def serialize_doc(doc: dict) -> dict:
    return json.loads(json.dumps(doc, default=bson_serial))

async def _get_job_or_raise(db, job_id: str):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format")
    job = await db.hr_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    desc = job.get("description") or ""
    if not desc:
        raise HTTPException(status_code=400, detail="Job description is empty")
    return job, desc


@router.get("/suggestions/{job_id}")
async def get_suggestions_for_job(
    job_id: str,
    limit: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns top N candidates from the ENTIRE pool that best match the job.
    Uses vector search only (fast, no LLM).
    """
    db = get_async_db()
    ai_service = AIMatchingService(db=db)
    try:
        job, job_desc = await _get_job_or_raise(db, job_id)
        top = await ai_service.find_top_candidates_for_job(job_desc, limit=limit)
        return [serialize_doc(c) for c in top]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await ai_service.close()


@router.get("/applicant-scores/{job_id}")
async def get_applicant_scores(
    job_id: str,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """
    For candidates who actually applied to the job, compute their LLM AI score.
    Fetches applications from job_applications, loads candidate profiles, runs LLM analysis.
    """
    db = get_async_db()
    ai_service = AIMatchingService(db=db)
    try:
        job, job_desc = await _get_job_or_raise(db, job_id)

        # 1. Find applications for this job
        applications = await db.job_applications.find(
            {"job_id": job_id}
        ).to_list(length=100)

        if not applications:
            return []

        # 2. Load each applicant's candidate profile and score them
        results = []
        for app in applications[:limit]:
            candidate_id = app.get("candidate_id") or app.get("user_id") or ""
            # Try fetching by string field first (Supabase UUID), then by ObjectId
            candidate = None
            if candidate_id:
                candidate = await db.candidates.find_one({"user_id": candidate_id})
                if not candidate and ObjectId.is_valid(candidate_id):
                    candidate = await db.candidates.find_one({"_id": ObjectId(candidate_id)})

            # Merge application-specific data (nested in profile_snapshot) into the candidate profile for evaluation
            app_snapshot = app.get("profile_snapshot", {})
            app_safe = {k: v for k, v in app_snapshot.items() if k not in ["created_at"]}
            
            # Use base candidate data if available, but let the snapshot submitted with the application override it
            candidate_for_eval = {**candidate, **app_safe} if candidate else app_safe
            
            # Extra safety: Ensure if basic fields like name are missing in snapshot, we don't break
            if not candidate_for_eval.get("firstName") and candidate:
                candidate_for_eval["firstName"] = candidate.get("firstName")
            if not candidate_for_eval.get("lastName") and candidate:
                candidate_for_eval["lastName"] = candidate.get("lastName")

            # Check if score already exists
            existing_score = app.get("ai_score")
            existing_justification = app.get("ai_justification")
            
            if existing_score is not None and existing_score > 0:
                # Use cached analysis
                analysis = {
                    "score": existing_score,
                    "justification": existing_justification or "Justification archivée."
                }
            else:
                # Run LLM Analysis
                analysis = await ai_service.evaluate_candidate_with_llm(job_desc, candidate_for_eval)
                
                # Persist result in database for future use
                await db.job_applications.update_one(
                    {"_id": app["_id"]},
                    {"$set": {
                        "ai_score": analysis.get("score", 0),
                        "ai_justification": analysis.get("justification", ""),
                        "ai_evaluated_at": datetime.utcnow()
                    }}
                )

            result = {
                "application_id": str(app["_id"]),
                "candidate_id": candidate_id,
                "firstName": candidate_for_eval.get("firstName") or candidate_for_eval.get("prenom") or "",
                "lastName": candidate_for_eval.get("lastName") or candidate_for_eval.get("nom") or "",
                "email": candidate_for_eval.get("email") or "",
                "avatar": candidate.get("avatar") or candidate.get("photo") if candidate else None,
                "ai_score": analysis.get("score", 0),
                "ai_justification": analysis.get("justification", ""),
                "applied_at": str(app.get("created_at") or app.get("applied_at") or ""),
                "status": app.get("status") or "pending",
            }
            results.append(result)

        # Sort by AI score descending
        results.sort(key=lambda x: x["ai_score"], reverse=True)
        return results

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await ai_service.close()


@router.post("/match/{job_id}")
async def get_matches_for_job(
    job_id: str, 
    limit: int = 5,
    deep_analysis: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Full orchestration: vector search + optional LLM deep analysis.
    """
    db = get_async_db()
    ai_service = AIMatchingService(db=db)
    
    try:
        job, job_desc = await _get_job_or_raise(db, job_id)

        top_candidates = await ai_service.find_top_candidates_for_job(job_desc, limit=limit)
        
        if not deep_analysis:
            return [serialize_doc(c) for c in top_candidates]

        analyzed_candidates = []
        for cand in top_candidates:
            analysis = await ai_service.evaluate_candidate_with_llm(job_desc, cand)
            cand["ai_score"] = analysis.get("score")
            cand["ai_justification"] = analysis.get("justification")
            analyzed_candidates.append(cand)
            
        analyzed_candidates.sort(key=lambda x: x.get("ai_score", 0), reverse=True)
        return [serialize_doc(c) for c in analyzed_candidates]

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await ai_service.close()
