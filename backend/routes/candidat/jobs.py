from fastapi import APIRouter, HTTPException, Header
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


def _generate_embedding_sync(text: str) -> list:
    """Synchronous call to Ollama to generate a text embedding."""
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{OLLAMA_BASE_URL}/embeddings",
                json={"model": EMBEDDING_MODEL, "prompt": text}
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


@router.get("/", summary="Get all published jobs with AI match score for this candidate")
def get_jobs(authorization: Optional[str] = Header(None)):
    db = connect_mongodb()["HumatiQ"]

    # ── 1. Fetch candidate profile ──────────────────────────────────────
    candidate_profile = None
    candidate_embedding = []
    if authorization:
        try:
            user_id = get_user_id_from_token(authorization)
            collection = get_candidates_collection()
            candidate_profile = collection.find_one({"user_id": user_id})
        except Exception as e:
            print(f"Could not load candidate profile for match scoring: {e}")

    # ── 2. Generate candidate embedding once ────────────────────────────
    if candidate_profile:
        candidate_text = _extract_text_for_embedding(candidate_profile)
        if candidate_text and candidate_text != "Profil vide.":
            candidate_embedding = _generate_embedding_sync(candidate_text)

    # ── 3. Aggregate published jobs with company info ────────────────────
    pipeline = [
        {"$match": {"status": "published"}},
        {
            "$addFields": {
                "company_oid": {
                    "$cond": {
                        "if": {"$and": [
                            {"$ne": ["$company_id", None]},
                            {"$ne": ["$company_id", ""]},
                            {"$eq": [{"$type": "$company_id"}, "string"]},
                            {"$eq": [{"$strLenCP": "$company_id"}, 24]}
                        ]},
                        "then": {"$toObjectId": "$company_id"},
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
        jobs_cursor = db.hr_jobs.aggregate(pipeline)
        jobs = []
        for job in jobs_cursor:
            job["_id"] = str(job["_id"])
            if "company_id" in job:
                job["company_id"] = str(job["company_id"])
            if "department_id" in job:
                job["department_id"] = str(job["department_id"])

            # ── 4. Compute match score ───────────────────────────────────
            match_score = 0
            if candidate_embedding:
                job_desc = job.get("description") or ""
                if job_desc:
                    job_embedding = _generate_embedding_sync(job_desc)
                    if job_embedding:
                        raw_sim = _cosine_similarity(candidate_embedding, job_embedding)
                        # Threshold + rescale (Lowered for better feedback on sparse profiles)
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
            jobs.append(job)

        # Sort by match score descending
        jobs.sort(key=lambda j: j.get("match_score", 0), reverse=True)
        return jobs

    except Exception as e:
        print(f"Aggregation failed: {e}")
        # Fallback – return jobs without match scores
        jobs_cursor = db.hr_jobs.find({"status": "published"})
        jobs = []
        for job in jobs_cursor:
            job["_id"] = str(job["_id"])
            job["company"] = "HumatiQ Partner"
            job["logo"] = "https://placeholder.pics/svg/200"
            job["match"] = "0%"
            job["match_score"] = 0
            job["matchTone"] = "muted"
            job["badgeIcon"] = "auto_awesome"
            jobs.append(job)
        return jobs


# ── Match score for a single job (used by JobDetail page) ──────────────

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

    candidate_text = _extract_text_for_embedding(candidate_profile)
    if candidate_text == "Profil vide.":
        return {"match_score": 0, "match": "0%", "matchTone": "muted"}

    candidate_embedding = _generate_embedding_sync(candidate_text)
    job_embedding = _generate_embedding_sync(job_desc)

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
