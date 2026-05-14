"""
routers/ai_analysis.py
-----------------------
AI Analysis routes powered by the Modele-CNN JobMarketAI engine.

All endpoints are prefixed with /api/ai-analysis  (set in main.py).

Routes
------
GET  /health                         → model load status (no auth required)

POST /profile-recommendation         → best-fit job profiles for a skill list
POST /skill-importance               → which skills the model values most
POST /skill-liaison                  → skills that naturally co-occur
POST /upskilling                     → what to learn to reach a target profile
POST /explore-skills                 → open-ended skill exploration
POST /job-match                      → score candidate skills vs job requirements
POST /full-analysis                  → all services in one call

GET  /candidate/{candidate_id}       → full analysis pulled from DB candidate profile
GET  /candidate/{candidate_id}/job-match/{job_id}
                                     → job-match score from DB objects
"""

from __future__ import annotations

from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database.mongodb_async import get_async_db
from middleware.auth import get_current_user
from services.job_market_ai_service import get_ai_engine, get_engine_status

router = APIRouter(prefix="/ai-analysis", tags=["AI Analysis (CNN Model)"])


# ── Pydantic request / response models ────────────────────────────────────────

class SkillsPayload(BaseModel):
    skills: List[str] = Field(..., min_length=1, description="Raw skill list")


class UpskillingPayload(BaseModel):
    skills:         List[str] = Field(..., min_length=1)
    target_profile: str       = Field(..., description="e.g. 'data_engineer', 'ml_engineer'")
    topk:           Optional[int] = None


class JobMatchPayload(BaseModel):
    candidate_skills: List[str] = Field(..., min_length=1)
    job_skills:       List[str] = Field(..., min_length=1)


class FullAnalysisPayload(BaseModel):
    skills:         List[str]      = Field(..., min_length=1)
    target_profile: Optional[str]  = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _engine_or_503():
    """Return the AI engine or raise 503 if not ready."""
    try:
        return get_ai_engine()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


def _validate_target_profile(ai, target_profile: str) -> None:
    """
    Raise HTTP 422 if target_profile is not a recognised label in the model's
    profile vocabulary.  Catches stale labels like 'legal', 'developer_experience',
    and 'sales_manager' that were removed in the 31-class retraining.
    """
    known: set = set(ai.profile_vocab.keys())
    if known and target_profile not in known:
        raise HTTPException(
            status_code=422,
            detail={
                "error": (
                    f"'{target_profile}' is not a valid target profile. "
                    "It may have been removed from the model's vocabulary."
                ),
                "valid_profiles": sorted(known),
            },
        )


def _extract_skills_from_candidate(candidate: dict) -> List[str]:
    """
    Pull a flat skill-name list out of a MongoDB candidate document.
    Handles both  [{"name": "Python", "level": "..."}]  and  ["Python", ...]  shapes.
    """
    raw = candidate.get("skills") or []
    result = []
    for item in raw:
        if isinstance(item, dict):
            name = item.get("name") or item.get("skill") or ""
            if name:
                result.append(str(name))
        elif isinstance(item, str):
            result.append(item)
    return result


def _extract_skills_from_job(job: dict) -> List[str]:
    """
    Pull required skills from a job document.
    Prioritizes structured 'Skill: ' tags. Falls back to full list for older jobs.
    """
    for key in ("requiredSkills", "required_skills", "skills", "requirements"):
        raw = job.get(key) or []
        if raw:
            result = []
            for item in raw:
                name = ""
                if isinstance(item, dict):
                    name = item.get("name") or item.get("skill") or ""
                elif isinstance(item, str):
                    name = item
                
                if name:
                    result.append(str(name))
            
            if result:
                # NEW LOGIC: If we have structured "Skill: " tags, use ONLY those.
                # This ensures we don't match against the general "Profile Recherché" text.
                prefixed_skills = [s.replace("Skill: ", "") for s in result if s.startswith("Skill: ")]
                if prefixed_skills:
                    return prefixed_skills
                
                # Fallback: remove "Langue: " tags even in fallback mode to avoid noise
                clean_fallback = [s for s in result if not s.startswith("Langue: ")]
                return clean_fallback if clean_fallback else result

    return []


# ── Known profiles fallback (used when CNN not yet loaded) ──────────────────────
_KNOWN_PROFILES = [
    "backend_developer", "cloud_architect", "data_analyst", "data_engineer",
    "data_scientist", "database_administrator", "devops_engineer",
    "embedded_systems_engineer", "frontend_developer", "fullstack_developer",
    "game_developer", "ios_developer", "android_developer", "machine_learning_engineer",
    "ml_engineer", "mobile_developer", "network_engineer", "product_manager",
    "qa_engineer", "security_engineer", "site_reliability_engineer",
    "software_architect", "software_engineer", "solutions_architect",
    "system_administrator", "technical_lead", "ui_engineer", "ux_designer",
    "devops_sre", "platform_engineer", "senior_frontend_engineer",
]


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/health")
def ai_analysis_health():
    """
    Returns the current load status of the JobMarketAI engine.
    Does NOT trigger model loading — safe to call at startup.
    """
    return get_engine_status()


@router.get("/profiles")
def list_known_profiles(current_user: dict = Depends(get_current_user)):
    """
    Returns the list of job profiles recognised by the CNN model.
    Falls back to a static list when the engine is not yet loaded.
    """
    try:
        ai = get_ai_engine()
        profiles = sorted(ai.profile_vocab.keys()) if ai.profile_vocab else _KNOWN_PROFILES
    except RuntimeError:
        profiles = sorted(_KNOWN_PROFILES)
    return [{"profile": p, "label": p.replace("_", " ").title()} for p in profiles]


# ── Service 4: Profile Recommendation ─────────────────────────────────────────

@router.post("/profile-recommendation")
def profile_recommendation(
    payload: SkillsPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Which job profiles best match a given skill set?

    Returns top-K profiles with confidence scores (0–1).
    Example response: [{"profile": "ml_engineer", "confidence": 0.85}, ...]
    """
    ai = _engine_or_503()
    try:
        return ai.profile_recommendation(payload.skills)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Service 1: Skill Importance ────────────────────────────────────────────────

@router.post("/skill-importance")
def skill_importance(
    payload: SkillsPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Which skills does the model value most in this set?

    Uses the transformer attention weights to rank skills.
    Returns: [{"skill": "python", "score": 0.42}, ...]
    """
    ai = _engine_or_503()
    try:
        return ai.skill_importance(payload.skills)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Service 2: Skill Liaison ───────────────────────────────────────────────────

@router.post("/skill-liaison")
def skill_liaison(
    payload: SkillsPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Which skills naturally co-occur with my skills (nearest neighbors in embedding space)?

    Returns: [{"skill": "numpy", "score": 0.78}, ...]
    """
    ai = _engine_or_503()
    try:
        return ai.skill_liaison(payload.skills)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Service 3: Upskilling ──────────────────────────────────────────────────────

@router.post("/upskilling")
def upskilling(
    payload: UpskillingPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    What skills should I learn to reach a specific target profile?

    Returns: [{"skill": "kubernetes", "score": 0.65}, ...]
    Ordered by recommended learning priority.
    """
    ai = _engine_or_503()
    _validate_target_profile(ai, payload.target_profile)
    try:
        kwargs = {}
        if payload.topk is not None:
            kwargs["topk"] = payload.topk
        return ai.upskilling(payload.skills, payload.target_profile, **kwargs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Service 3b: Explore Skills ─────────────────────────────────────────────────

@router.post("/explore-skills")
def explore_skills(
    payload: SkillsPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    What new skills could I explore? (open-ended — no fixed target profile)

    Samples from the VAE prior to produce diverse suggestions.
    Returns: [{"skill": "airflow", "score": 0.55}, ...]
    """
    ai = _engine_or_503()
    try:
        return ai.explore_skills(payload.skills)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Service 5: Job Match Score ─────────────────────────────────────────────────

@router.post("/job-match")
def job_match(
    payload: JobMatchPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Score how well a candidate's skills match a job's required skills.

    Three-tier scoring per job skill:
    - matched   → candidate already has it  (score = 1.0)
    - similar   → semantically close        (score = cosine_sim)
    - learnable → somewhat related          (score = cosine_sim × 0.7)
    - missing   → not covered               (score = 0.0)

    Returns a final 0–100 score plus a per-skill breakdown.
    """
    ai = _engine_or_503()
    try:
        return ai.job_match_score(payload.candidate_skills, payload.job_skills)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Full Analysis ──────────────────────────────────────────────────────────────

@router.post("/full-analysis")
def full_analysis(
    payload: FullAnalysisPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Run all AI services in a single call.

    Returns:
    {
      "normalized_skills":       [...],
      "profile_recommendation":  [...],
      "skill_importance":        [...],
      "skill_liaison":           [...],
      "explore_skills":          [...],
      "upskilling":              [...]   ← only if target_profile is provided
    }
    """
    ai = _engine_or_503()
    if payload.target_profile is not None:
        _validate_target_profile(ai, payload.target_profile)
    try:
        return ai.full_analysis(payload.skills, target_profile=payload.target_profile)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── DB-backed: Candidate Full Analysis ────────────────────────────────────────

@router.get("/candidate/{candidate_id}")
async def analyze_candidate_from_db(
    candidate_id: str,
    target_profile: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Run full AI analysis on a candidate fetched from the database.

    The candidate's skill list is extracted automatically from their profile.
    Optionally pass ?target_profile=data_engineer to include upskilling recommendations.

    Returns the same structure as POST /full-analysis.
    """
    db = get_async_db()

    # Fetch candidate
    candidate = None
    if ObjectId.is_valid(candidate_id):
        candidate = await db.candidates.find_one({"_id": ObjectId(candidate_id)})
    if not candidate:
        candidate = await db.candidates.find_one({"user_id": candidate_id})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    skills = _extract_skills_from_candidate(candidate)
    if not skills:
        raise HTTPException(
            status_code=400,
            detail="Candidate profile has no skills to analyse."
        )

    ai = _engine_or_503()
    if target_profile is not None:
        _validate_target_profile(ai, target_profile)
    try:
        result = ai.full_analysis(skills, target_profile=target_profile)
        
        result["candidate_id"] = candidate_id
        result["candidate_name"] = (
            f"{candidate.get('firstName', '')} {candidate.get('lastName', '')}".strip()
            or candidate.get("name", "")
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── DB-backed: Candidate × Job Match ──────────────────────────────────────────

@router.get("/candidate/{candidate_id}/job-match/{job_id}")
async def candidate_job_match_from_db(
    candidate_id: str,
    job_id:       str,
    current_user: dict = Depends(get_current_user),
):
    """
    Score how well a specific candidate matches a specific job, both fetched from DB.

    Returns the job_match_score result (0–100 + per-skill breakdown).
    """
    db = get_async_db()

    # Fetch candidate
    candidate = None
    if ObjectId.is_valid(candidate_id):
        candidate = await db.candidates.find_one({"_id": ObjectId(candidate_id)})
    if not candidate:
        candidate = await db.candidates.find_one({"user_id": candidate_id})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Fetch job
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format")
    job = await db.hr_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_skills = _extract_skills_from_candidate(candidate)
    job_skills       = _extract_skills_from_job(job)

    if not candidate_skills:
        raise HTTPException(status_code=400, detail="Candidate has no skills in their profile.")
    if not job_skills:
        raise HTTPException(status_code=400, detail="Job has no required skills listed.")

    ai = _engine_or_503()
    try:
        result = ai.job_match_score(candidate_skills, job_skills)
        
        # Add aliases for frontend consistency (ApplicationTrack.jsx)
        result["overall_score"] = result.get("score", 0)
        result["skill_breakdown"] = result.get("breakdown", [])
        
        result["candidate_id"]   = candidate_id
        result["job_id"]         = job_id
        result["job_title"]      = job.get("title", "")
        result["candidate_name"] = (
            f"{candidate.get('firstName', '')} {candidate.get('lastName', '')}".strip()
            or candidate.get("name", "")
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
