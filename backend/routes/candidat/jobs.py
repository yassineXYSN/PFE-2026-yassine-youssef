from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional
import httpx
import numpy as np
from database.mongodb import connect_mongodb
from .helpers import get_user_id_from_token, get_candidates_collection

router = APIRouter(prefix="/candidat/jobs", tags=["candidat-jobs"])

OLLAMA_BASE_URL = "http://localhost:11434/api"
EMBEDDING_MODEL = "nomic-embed-text"


def _extract_text_for_embedding(profile: dict) -> str:
    """
    Mirrors the logic in services/ai_matching.py to build a rich semantic
    text representation of a candidate profile. Improved to handle inconsistent naming.
    """
    parts = []

    # Name
    fname = profile.get("firstName") or profile.get("first_name") or profile.get("prenom") or ""
    lname = profile.get("lastName") or profile.get("last_name") or profile.get("nom") or ""
    if fname or lname:
        parts.append(f"Candidat : {fname} {lname}".strip())

    # Title
    title = (profile.get("title") or profile.get("titre") or
             profile.get("headline") or profile.get("posteActuel") or "")
    if title:
        parts.append(f"Titre/Poste : {title}")

    # Bio / Summary
    summary = (profile.get("summary") or profile.get("resume") or
               profile.get("about") or profile.get("bio") or "")
    if summary:
        parts.append(f"Résumé professionnel : {summary}")

    # Skills
    skills_data = profile.get("skills") or profile.get("competences") or []
    if skills_data:
        if isinstance(skills_data, list):
            skill_names = []
            for s in skills_data:
                if isinstance(s, dict):
                    name = s.get("name") or s.get("label") or s.get("nom") or s.get("value") or ""
                    if name:
                        skill_names.append(str(name))
                else:
                    skill_names.append(str(s))
            if skill_names:
                parts.append(f"Compétences : {', '.join(filter(None, skill_names))}")
        elif isinstance(skills_data, str):
            parts.append(f"Compétences : {skills_data}")

    # Experiences (Handles both 'experience' and 'experiences')
    experiences = (profile.get("experiences") or profile.get("experience") or
                   profile.get("experiencesProfessionnelles") or [])
    if experiences and isinstance(experiences, list):
        exp_texts = []
        for exp in experiences:
            if not isinstance(exp, dict):
                continue
            role = (exp.get("title") or exp.get("role") or exp.get("position") or
                    exp.get("jobTitle") or exp.get("poste") or "")
            company = exp.get("company") or exp.get("entreprise") or ""
            description = exp.get("description") or exp.get("missions") or ""
            if not role:
                role = "Poste"
            exp_str = f"- {role}"
            if company:
                exp_str += f" chez {company}"
            if description:
                exp_str += f". {description}"
            exp_texts.append(exp_str)
        if exp_texts:
            parts.append("Expériences :\n" + "\n".join(exp_texts))

    # Education (Handles both 'education' and 'educations')
    education = (profile.get("educations") or profile.get("education") or
                 profile.get("formations") or profile.get("diplomas") or [])
    if education and isinstance(education, list):
        edu_texts = []
        for edu in education:
            if not isinstance(edu, dict):
                continue
            degree = edu.get("degree") or edu.get("diploma") or edu.get("diplome") or ""
            school = edu.get("school") or edu.get("institution") or edu.get("etablissement") or ""
            field = edu.get("field_of_study") or edu.get("field") or edu.get("domaine") or ""
            if not degree:
                degree = "Formation"
            edu_str = f"- {degree}"
            if field:
                edu_str += f" en {field}"
            if school:
                edu_str += f" ({school})"
            edu_texts.append(edu_str)
        if edu_texts:
            parts.append("Formation :\n" + "\n".join(edu_texts))

    # Certifications
    certificates = profile.get("certifications") or profile.get("certificates") or []
    if certificates and isinstance(certificates, list):
        cert_texts = []
        for cert in certificates:
            if not isinstance(cert, dict):
                continue
            name = cert.get("name") or cert.get("nom") or cert.get("title") or ""
            issuer = cert.get("issuer") or cert.get("issuingOrganization") or ""
            cert_str = f"- {name}"
            if issuer:
                cert_str += f" délivré par {issuer}"
            cert_texts.append(cert_str)
        if cert_texts:
            parts.append("Certifications :\n" + "\n".join(cert_texts))

    # Languages
    languages = profile.get("languages") or profile.get("langues") or []
    if languages and isinstance(languages, list):
        lang_texts = []
        for l in languages:
            if isinstance(l, dict):
                name = l.get("name") or l.get("langue") or ""
                level = l.get("level") or l.get("niveau") or ""
                if name:
                    lang_texts.append(f"{name} ({level})" if level else name)
            else:
                lang_texts.append(str(l))
        if lang_texts:
            parts.append(f"Langues : {', '.join(lang_texts)}")

    final_text = "\n\n".join(parts).strip()
    
    # Very low threshold (10 chars) to ensure even sparse profiles get some match
    if len(final_text) < 10:
        return "Profil vide."
    return final_text


from utils.ai_settings import fake_analysis_enabled
import random

def _generate_embedding_sync(text: str) -> list:
    """Synchronous call to Ollama to generate a text embedding."""
    if fake_analysis_enabled():
        # Vectors between 0 and 1 have an expected cosine similarity of ~0.75
        return [random.uniform(0, 1) for _ in range(768)]
        
    try:
        import os as _os
        _num_gpu = int(_os.getenv("OLLAMA_NUM_GPU_LAYERS", "99"))
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{OLLAMA_BASE_URL}/embeddings",
                json={"model": EMBEDDING_MODEL, "prompt": text, "options": {"num_gpu": _num_gpu}}
            )
            response.raise_for_status()
            return response.json().get("embedding", [])
    except Exception as e:
        print(f"Embedding error: {e}")
        return []


def _cosine_similarity(a: list, b: list) -> float:
    """Compute cosine similarity between two vectors."""
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


def _score_to_match_string(score: float) -> str:
    """Convert a 0-100 integer score to a display string."""
    return f"{int(round(score))}%"


def _score_to_tone(score: float) -> str:
    """Map a 0-100 score to a match tone class."""
    if score >= 70:
        return "strong"
    if score >= 40:
        return "medium"
    return "muted"


def _parse_job_datetime(value):
    """Best-effort parsing for Mongo/native datetimes and ISO-like strings."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, dict):
        nested_date = value.get("$date")
        if nested_date is not None:
            return _parse_job_datetime(nested_date)
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _is_job_deadline_active(job: dict) -> bool:
    """Keep jobs with no deadline or with a deadline that has not passed yet."""
    deadline = _parse_job_datetime(job.get("deadline"))
    if deadline is None:
        return True
    return deadline >= datetime.now(timezone.utc)


@router.get("/", summary="Get paginated published jobs with AI Match")
def get_jobs(
    authorization: Optional[str] = Header(None),
    page: int = Query(1, ge=1),
    limit: int = Query(9, ge=1),
    search: Optional[str] = None,
    jobType: Optional[str] = None,
    experience: Optional[str] = None,
    sort: Optional[str] = "recent",
    savedOnly: bool = False
):
    db = connect_mongodb()["HumatiQ"]

    user_id = None
    if authorization:
        try:
            user_id = get_user_id_from_token(authorization)
        except Exception:
            pass

    # 1. Match pipeline (Filter out unpublished, apply search/filters)
    match_stage = {"status": "published"}
    if search:
        match_stage["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if jobType and jobType != "any":
        match_stage["work_mode"] = {"$regex": f"^{jobType}$", "$options": "i"}
    if experience and experience != "any":
        match_stage["experience_level"] = {"$regex": f"^{experience}$", "$options": "i"}

    if savedOnly and user_id:
        from bson import ObjectId
        saved_records = list(db.saved_jobs.find({"candidate_id": user_id}))
        saved_ids = [ObjectId(r["job_id"]) for r in saved_records if ObjectId.is_valid(r["job_id"])]
        match_stage["_id"] = {"$in": saved_ids}

    # 2. Pipeline fetching ALL matching jobs with Company Info resolved
    pipeline = [
        {"$match": match_stage},
        {
            "$addFields": {
                "company_oid": {
                    "$cond": {
                        "if": {"$eq": [{"$type": "$company_id"}, "string"]},
                        "then": {
                            "$cond": {
                                "if": {"$eq": [{"$strLenCP": "$company_id"}, 24]},
                                "then": {"$toObjectId": "$company_id"},
                                "else": "$company_id"
                            }
                        },
                        "else": "$company_id"
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
                "company": {"$ifNull": ["$company_info.name", "HumatiQ Partner"]},
                "logo": {"$ifNull": ["$company_info.logo_url", "https://placeholder.pics/svg/200"]}
            }
        },
        {
            "$project": {
                "company_oid": 0,
                "company_info": 0
            }
        }
    ]

    try:
        jobs_data = list(db.hr_jobs.aggregate(pipeline))
        jobs_data = [job for job in jobs_data if _is_job_deadline_active(job)]
        total = len(jobs_data)

        if total == 0:
            return {"jobs": [], "total": 0, "page": page, "limit": limit}

        # --- 3. Generate Candidate Embedding ---
        candidate_embedding = None
        if user_id:
            try:
                candidate_profile = get_candidates_collection().find_one({"user_id": user_id})
                if candidate_profile:
                    candidate_embedding = candidate_profile.get("embedding")
                    if not candidate_embedding:
                        candidate_text = _extract_text_for_embedding(candidate_profile)
                        if candidate_text and candidate_text != "Profil vide.":
                            candidate_embedding = _generate_embedding_sync(candidate_text)
                            if candidate_embedding:
                                get_candidates_collection().update_one(
                                    {"_id": candidate_profile["_id"]},
                                    {"$set": {"embedding": candidate_embedding}}
                                )
            except Exception as e:
                print(f"Could not prepare candidate embedding: {e}")

        # --- 4. Compute Match Scores for ALL fetched jobs ---
        for job in jobs_data:
            job["_id"] = str(job["_id"])
            if "company_id" in job:
                job["company_id"] = str(job["company_id"])
            if "department_id" in job:
                job["department_id"] = str(job["department_id"])

            match_score = 0
            if candidate_embedding:
                job_embedding = job.get("embedding")
                if job_embedding:
                    raw_sim = _cosine_similarity(candidate_embedding, job_embedding)
                    threshold = 0.50
                    if raw_sim <= threshold:
                        adjusted = 0.0
                    else:
                        adjusted = (raw_sim - threshold) / (1.0 - threshold)
                    match_score = min(100, round(adjusted * 100))

            job["match"] = _score_to_match_string(match_score)
            job["match_score"] = match_score
            job["matchTone"] = _score_to_tone(match_score)
            job["badgeIcon"] = "auto_awesome"

        # --- 5. Sort jobs in memory ---
        if sort == "salary":
            jobs_data.sort(key=lambda j: int(j.get("salary_range", "0").split("-")[-1] if "-" in j.get("salary_range", "") else j.get("salary_range", 0) or 0), reverse=True)
        elif sort == "match":
            jobs_data.sort(key=lambda j: j.get("match_score", 0), reverse=True)
        else: # "recent"
            jobs_data.sort(key=lambda j: j.get("created_at", getattr(j, "_id", "")), reverse=True)
        
        # --- 6. Paginate python list ---
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_jobs = jobs_data[start_idx:end_idx]

        return {
            "jobs": paginated_jobs,
            "total": total,
            "page": page,
            "limit": limit
        }

    except Exception as e:
        print(f"Aggregation/Matching failed: {e}")
        return {"jobs": [], "total": 0, "page": page, "limit": limit}

@router.get("/match/{job_id}", summary="Get AI match score for a specific job")
def get_job_match_score(job_id: str, authorization: Optional[str] = Header(None)):
    """
    Returns match score and tone for a specific job vs. the candidate's profile.
    Fast: one candidate embedding + one job embedding → cosine similarity.
    """
    from bson import ObjectId

    db = connect_mongodb()["HumatiQ"]

    # Validate job id
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID")

    # Fetch the job
    job = db.hr_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job_desc = job.get("description") or ""
    if not job_desc:
        return {"match_score": 0, "match": "0%", "matchTone": "muted"}

    # Fetch candidate profile
    candidate_profile = None
    if authorization:
        try:
            user_id = get_user_id_from_token(authorization)
            collection = get_candidates_collection()
            candidate_profile = collection.find_one({"user_id": user_id})
        except Exception as e:
            print(f"Could not load candidate profile: {e}")

    if not candidate_profile:
        return {"match_score": 0, "match": "0%", "matchTone": "muted"}

    candidate_embedding = candidate_profile.get("embedding")
    if not candidate_embedding:
        candidate_text = _extract_text_for_embedding(candidate_profile)
        if candidate_text != "Profil vide.":
            candidate_embedding = _generate_embedding_sync(candidate_text)
            if candidate_embedding:
                get_candidates_collection().update_one(
                    {"_id": candidate_profile["_id"]},
                    {"$set": {"embedding": candidate_embedding}}
                )

    job_embedding = job.get("embedding")
    
    if not candidate_embedding or not job_embedding:
        return {"match_score": 0, "match": "0%", "matchTone": "muted"}

    raw_sim = _cosine_similarity(candidate_embedding, job_embedding)
    threshold = 0.50
    if raw_sim <= threshold:
        adjusted = 0.0
    else:
        adjusted = (raw_sim - threshold) / (1.0 - threshold)

    match_score = min(100, round(adjusted * 100))

    return {
        "match_score": match_score,
        "match": _score_to_match_string(match_score),
        "matchTone": _score_to_tone(match_score),
    }
