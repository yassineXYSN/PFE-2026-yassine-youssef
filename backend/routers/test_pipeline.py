"""
Test Pipeline Router
Exposes the automation funnel test as an HTTP endpoint so the frontend
UI can trigger it without running the CLI script.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import certifi
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from database.mongodb_async import get_async_db
from middleware.auth import get_current_user
from services.job_automation import run_deadline_automation_for_job

router = APIRouter(prefix="/test-pipeline", tags=["Test Pipeline"])


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Fake candidate pool ───────────────────────────────────────────────────────

FAKE_CANDIDATES = [
    {
        "firstName": "Amine",
        "lastName": "Trabelsi",
        "email": "amine.trabelsi.fake@humatiq-test.io",
        "title": "Développeur Full-Stack Senior",
        "about": (
            "5 ans d'expérience en développement web full-stack. "
            "Expert React, Node.js et MongoDB. Passionné par les architectures micro-services "
            "et l'automatisation des tests. A travaillé sur des plateformes SaaS B2B."
        ),
        "skills": ["React", "Node.js", "MongoDB", "TypeScript", "Docker", "CI/CD", "REST APIs", "GraphQL"],
        "experiences": [
            {
                "company": "Sofrecom Tunisia",
                "position": "Full-Stack Developer",
                "startDate": "2020-01",
                "endDate": "2024-01",
                "description": "Development of telecom management dashboards using React and Node.js.",
            }
        ],
        "educations": [{"degree": "Ingénieur en Informatique", "institution": "ESPRIT", "year": 2019}],
        "languages": ["Arabe", "Français", "Anglais"],
    },
    {
        "firstName": "Sarra",
        "lastName": "Ben Amor",
        "email": "sarra.benamor.fake@humatiq-test.io",
        "title": "Développeuse Frontend React",
        "about": (
            "3 ans d'expérience en développement frontend avec React et Vue.js. "
            "Bonne maîtrise de Tailwind CSS et des tests unitaires avec Jest. "
            "Notions de backend avec Express.js."
        ),
        "skills": ["React", "Vue.js", "Tailwind CSS", "Jest", "JavaScript", "HTML", "CSS"],
        "experiences": [
            {
                "company": "Vermeg",
                "position": "Frontend Developer",
                "startDate": "2021-03",
                "endDate": "2024-03",
                "description": "Building financial dashboard UIs in React.",
            }
        ],
        "educations": [{"degree": "Licence en Informatique", "institution": "FST Tunis", "year": 2020}],
        "languages": ["Arabe", "Français"],
    },
    {
        "firstName": "Khalil",
        "lastName": "Mansour",
        "email": "khalil.mansour.fake@humatiq-test.io",
        "title": "Ingénieur DevOps & Backend Python",
        "about": (
            "Ingénieur DevOps avec 4 ans d'expérience. Expert en Kubernetes, Terraform "
            "et pipelines CI/CD. Compétences solides en Python (FastAPI, Django) et bases "
            "de données PostgreSQL et MongoDB."
        ),
        "skills": ["Python", "FastAPI", "Kubernetes", "Docker", "Terraform", "PostgreSQL", "MongoDB", "Linux"],
        "experiences": [
            {
                "company": "Orange Digital Center",
                "position": "DevOps Engineer",
                "startDate": "2020-06",
                "endDate": "2024-06",
                "description": "Orchestration des déploiements cloud et automatisation des pipelines.",
            }
        ],
        "educations": [{"degree": "Ingénieur en Systèmes Informatiques", "institution": "ENIT", "year": 2020}],
        "languages": ["Arabe", "Français", "Anglais"],
    },
    {
        "firstName": "Nour",
        "lastName": "Jouini",
        "email": "nour.jouini.fake@humatiq-test.io",
        "title": "Développeuse Web Junior",
        "about": (
            "Jeune développeuse avec 1 an d'expérience. Maîtrise HTML, CSS et notions de React. "
            "En cours d'apprentissage de Node.js et des APIs REST."
        ),
        "skills": ["HTML", "CSS", "JavaScript", "React (notions)", "Git"],
        "experiences": [
            {
                "company": "Startup locale",
                "position": "Stagiaire Développement Web",
                "startDate": "2023-07",
                "endDate": "2024-01",
                "description": "Création de landing pages et intégration de maquettes Figma.",
            }
        ],
        "educations": [{"degree": "Licence en Multimédia", "institution": "ISAMM Tunis", "year": 2023}],
        "languages": ["Arabe", "Français"],
    },
    {
        "firstName": "Youssef",
        "lastName": "Chaker",
        "email": "youssef.chaker.fake@humatiq-test.io",
        "title": "Lead Développeur Full-Stack & Architecte Cloud",
        "about": (
            "8 ans d'expérience en développement logiciel. Expert en architecture micro-services, "
            "React, Next.js, Node.js, Python, AWS et Azure. A dirigé des équipes de 10+ développeurs "
            "et livré des projets à grande échelle pour des clients européens."
        ),
        "skills": [
            "React", "Next.js", "Node.js", "Python", "FastAPI", "AWS", "Azure",
            "MongoDB", "PostgreSQL", "Redis", "Docker", "Kubernetes", "TypeScript",
            "System Design", "Team Leadership",
        ],
        "experiences": [
            {
                "company": "Capgemini Tunisia",
                "position": "Lead Full-Stack Developer",
                "startDate": "2016-09",
                "endDate": "2024-04",
                "description": "Architecture and delivery of SaaS platforms for European clients.",
            }
        ],
        "educations": [{"degree": "Ingénieur en Génie Logiciel", "institution": "SUP'COM", "year": 2016}],
        "languages": ["Arabe", "Français", "Anglais", "Espagnol"],
    },
]


# ── Request / Response models ─────────────────────────────────────────────────

class RunPipelineRequest(BaseModel):
    job_id: str
    document_id: Optional[str] = None


class CandidateResult(BaseModel):
    name: str
    status: str
    vector_score: float
    cnn_score: float
    ai_score: int
    quiz_status: str


class RunPipelineResponse(BaseModel):
    job_title: str
    job_id: str
    run_id: str
    applications_considered: int
    vector_shortlist_count: int
    ai_shortlist_count: int
    quizzes_published: int
    promoted_to_interview: List[str]
    candidates: List[Dict[str, Any]]
    created_candidate_ids: List[str]
    created_app_ids: List[str]
    created_quiz_ids: List[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_automation_config(job: Dict[str, Any], document_id: Optional[str], document_title: str) -> Optional[Dict[str, Any]]:
    """Return a patched ai_automation dict if the job is missing a valid one, else None."""
    ai_auto = job.get("ai_automation") or {}
    quiz_stage = ai_auto.get("quiz_stage") or {}
    quiz_configs = quiz_stage.get("quizzes") or []

    already_ready = (
        ai_auto.get("enabled")
        and quiz_stage.get("enabled")
        and len(quiz_configs) > 0
    )
    if already_ready and document_id is None:
        return None  # nothing to patch

    quiz_deadline = (_now() + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S")

    # If a quiz doc was uploaded/chosen use it; otherwise keep existing config's doc or use a placeholder
    if document_id:
        quiz_entry = {
            "title": f"Quiz Technique – {document_title}",
            "document_id": document_id,
            "document_title": document_title,
            "total_questions": 8,
            "duration_minutes": 20,
            "weight_percentage": 100,
            "difficulty_mix": {"easy": 0.35, "medium": 0.45, "hard": 0.20},
            "deadline_mode": "absolute",
            "deadline_at": quiz_deadline,
        }
    elif already_ready:
        # Keep existing quiz config, just ensure enabled
        return {"ai_automation.enabled": True}
    else:
        # No document provided and no existing config — can't create quizzes
        quiz_entry = None

    patched = {
        "enabled": True,
        "trigger_mode": "deadline",
        "vector_filter": {
            "enabled": True,
            "top_x_candidates": 5,
            "top_y_candidates": None,
        },
        "ai_score_filter": {
            "enabled": True,
            "top_x_candidates": None,
            "top_y_candidates": 3,
        },
        "quiz_stage": {
            "enabled": quiz_entry is not None,
            "approve_top_z_to_interview": 2,
            "quizzes": [quiz_entry] if quiz_entry else [],
        },
    }
    return patched


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/run", response_model=RunPipelineResponse)
async def run_test_pipeline(
    body: RunPipelineRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Creates 5 fake candidates, applies them to the chosen job, then runs the
    full AI automation funnel. Returns a structured report.
    """
    db = get_async_db()

    if not ObjectId.is_valid(body.job_id):
        raise HTTPException(status_code=400, detail="Invalid job_id")

    job = await db.hr_jobs.find_one({"_id": ObjectId(body.job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job_id = str(job["_id"])
    job_title = job.get("title", "(no title)")

    created_candidate_ids: List[str] = []
    fake_user_ids: List[str] = []
    created_app_ids: List[str] = []
    candidate_names: List[str] = []

    # ── Resolve quiz document if a document_id was supplied ──────────────────
    document_title = "Document Technique"
    if body.document_id:
        doc = await db.quiz_documents.find_one({"_id": ObjectId(body.document_id)}) if ObjectId.is_valid(body.document_id) else None
        if doc:
            document_title = doc.get("title") or doc.get("filename") or document_title

    # ── If no doc provided, fall back to any ready doc in the DB ─────────────
    effective_doc_id = body.document_id
    if not effective_doc_id:
        fallback = await db.quiz_documents.find_one({"status": "ready"}) or await db.quiz_documents.find_one({})
        if fallback:
            effective_doc_id = str(fallback["_id"])
            document_title = fallback.get("title") or fallback.get("filename") or document_title

    # ── Patch automation config if needed ────────────────────────────────────
    patched = _ensure_automation_config(job, effective_doc_id, document_title)
    if patched is not None:
        if "ai_automation.enabled" in patched:
            await db.hr_jobs.update_one({"_id": job["_id"]}, {"$set": patched})
        else:
            await db.hr_jobs.update_one({"_id": job["_id"]}, {"$set": {"ai_automation": patched}})

    # ── Patch deadline to the past ────────────────────────────────────────────
    past_deadline = (_now() - timedelta(minutes=5)).isoformat()
    await db.hr_jobs.update_one(
        {"_id": job["_id"]},
        {"$set": {"deadline": past_deadline, "allow_hr": False}},
    )

    # Re-fetch with all patches applied
    job = await db.hr_jobs.find_one({"_id": ObjectId(job_id)})

    # ── Create fake candidates ────────────────────────────────────────────────
    for cand_data in FAKE_CANDIDATES:
        fake_user_id = f"test-user-{ObjectId()}"
        candidate_doc = {
            **cand_data,
            "user_id": fake_user_id,
            "created_at": _now(),
            "updated_at": _now(),
        }
        res = await db.candidates.insert_one(candidate_doc)
        created_candidate_ids.append(str(res.inserted_id))
        fake_user_ids.append(fake_user_id)
        candidate_names.append(f"{cand_data['firstName']} {cand_data['lastName']}")

    # ── Submit applications ───────────────────────────────────────────────────
    for cand_mongo_id, fake_user_id, full_name in zip(created_candidate_ids, fake_user_ids, candidate_names):
        cand = await db.candidates.find_one({"_id": ObjectId(cand_mongo_id)})
        snapshot = {
            k: cand.get(k)
            for k in ["firstName", "lastName", "skills", "experiences", "educations", "languages", "title", "about"]
            if cand.get(k)
        }
        app_doc = {
            "candidate_id": fake_user_id,
            "job_id": job_id,
            "motivation_letter": (
                f"Bonjour, je suis {full_name} et je souhaite postuler au poste de {job_title}. "
                "Mon expérience correspond aux exigences du poste. Merci."
            ),
            "status": "new",
            "profile_snapshot": snapshot,
            "applied_at": _now(),
        }
        res = await db.job_applications.insert_one(app_doc)
        created_app_ids.append(str(res.inserted_id))

    # ── Run automation ────────────────────────────────────────────────────────
    result = await run_deadline_automation_for_job(db, job)
    run_id = result.get("run_id", "")

    # ── Collect generated quiz IDs ────────────────────────────────────────────
    quizzes_found = await db.quizzes.find({"automation_run_id": run_id}).to_list(length=100)
    created_quiz_ids = [str(q["_id"]) for q in quizzes_found]

    # ── Build per-candidate breakdown ─────────────────────────────────────────
    apps_after = await db.job_applications.find({"job_id": job_id}).to_list(length=50)
    apps_after.sort(key=lambda a: (a.get("ai_score") or 0), reverse=True)

    candidate_rows: List[Dict[str, Any]] = []
    for app in apps_after:
        cand_doc = await db.candidates.find_one({"user_id": app.get("candidate_id")})
        name = (
            f"{cand_doc.get('firstName', '')} {cand_doc.get('lastName', '')}".strip()
            if cand_doc else str(app.get("candidate_id", ""))
        )
        candidate_rows.append({
            "application_id": str(app["_id"]),
            "name": name,
            "status": app.get("status", "?"),
            "vector_score": round(app.get("vector_match_score") or app.get("automation_vector_score") or 0, 1),
            "cnn_score": round(app.get("cnn_score") or 0, 1),
            "ai_score": int(app.get("ai_score") or 0),
            "quiz_status": app.get("quiz_status") or "—",
        })

    return RunPipelineResponse(
        job_title=job_title,
        job_id=job_id,
        run_id=run_id,
        applications_considered=result.get("applications_considered", 0),
        vector_shortlist_count=result.get("vector_shortlist_count", 0),
        ai_shortlist_count=result.get("ai_shortlist_count", 0),
        quizzes_published=result.get("quizzes_published", 0),
        promoted_to_interview=result.get("promoted_to_interview", []),
        candidates=candidate_rows,
        created_candidate_ids=created_candidate_ids,
        created_app_ids=created_app_ids,
        created_quiz_ids=created_quiz_ids,
    )


@router.delete("/cleanup")
async def cleanup_test_run(
    candidate_ids: str = "",
    app_ids: str = "",
    quiz_ids: str = "",
    current_user: dict = Depends(get_current_user),
):
    """Delete fake candidates, applications and quizzes created by a test run."""
    db = get_async_db()
    deleted: Dict[str, int] = {"candidates": 0, "applications": 0, "quizzes": 0}

    if quiz_ids:
        ids = [ObjectId(i) for i in quiz_ids.split(",") if ObjectId.is_valid(i)]
        if ids:
            r = await db.quizzes.delete_many({"_id": {"$in": ids}})
            deleted["quizzes"] = r.deleted_count

    if app_ids:
        ids = [ObjectId(i) for i in app_ids.split(",") if ObjectId.is_valid(i)]
        if ids:
            r = await db.job_applications.delete_many({"_id": {"$in": ids}})
            deleted["applications"] = r.deleted_count

    if candidate_ids:
        ids = [ObjectId(i) for i in candidate_ids.split(",") if ObjectId.is_valid(i)]
        if ids:
            r = await db.candidates.delete_many({"_id": {"$in": ids}})
            deleted["candidates"] = r.deleted_count

    return {"deleted": deleted}
