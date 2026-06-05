import asyncio
import logging
import math
import os
from datetime import datetime, time
from typing import Any, Dict, List, Optional

_EMBED_CONCURRENCY = int(os.getenv("QUIZ_EMBED_MAX_CONCURRENT", "8"))
_LLM_CONCURRENCY = int(os.getenv("AI_MATCHING_MAX_CONCURRENT", "3"))

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from services.ai_matching import AIMatchingService
from services.job_market_ai_service import get_ai_engine
from services.quiz.generation import generate_quiz
from services.quiz.metadata import (
    compute_overlap_with_existing,
    record_quiz_provenance,
    update_chunk_usage,
)
from services.quiz.retrieval import retrieve_chunks_for_quiz
from services.quiz.templates import resolve_template_config, validate_quiz_output
from utils.ai_settings import quiz_generation_is_mock
from utils.notifications import create_notification
from routers.ai_analysis import _extract_skills_from_candidate, _extract_skills_from_job


logger = logging.getLogger(__name__)

DEFAULT_QUIZ_DURATION_MINUTES = 10
MAX_QUIZ_DURATION_MINUTES = 180
VECTOR_THRESHOLD = 0.50


def _stringify_id(value: Any) -> str:
    return str(value) if value is not None else ""


def _parse_datetime_value(value: Any, *, end_of_day_for_date_only: bool = False) -> Optional[datetime]:
    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo:
            return value.astimezone().replace(tzinfo=None)
        return value

    if isinstance(value, dict):
        nested = value.get("$date")
        if nested is not None:
            return _parse_datetime_value(nested, end_of_day_for_date_only=end_of_day_for_date_only)
        return None

    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None

        try:
            if len(candidate) == 10 and candidate.count("-") == 2:
                parsed = datetime.fromisoformat(candidate)
                if end_of_day_for_date_only:
                    return datetime.combine(parsed.date(), time(23, 59, 59, 999999))
                return parsed

            normalized = candidate[:-1] + "+00:00" if candidate.endswith("Z") else candidate
            parsed = datetime.fromisoformat(normalized)
            if parsed.tzinfo:
                return parsed.astimezone().replace(tzinfo=None)
            return parsed
        except ValueError:
            return None

    return None


def resolve_job_deadline(job: Dict[str, Any]) -> Optional[datetime]:
    return _parse_datetime_value(job.get("deadline"), end_of_day_for_date_only=True)


def resolve_quiz_stage_deadline(job: Dict[str, Any]) -> Optional[datetime]:
    ai_automation = job.get("ai_automation") or {}
    quiz_stage = ai_automation.get("quiz_stage") or {}
    quiz_configs = quiz_stage.get("quizzes") or []

    latest_deadline: Optional[datetime] = None
    for quiz_cfg in quiz_configs:
        parsed = _parse_datetime_value(quiz_cfg.get("deadline_at"))
        if parsed and (latest_deadline is None or parsed > latest_deadline):
            latest_deadline = parsed

    return latest_deadline


def automation_uses_deadline_trigger(job: Dict[str, Any]) -> bool:
    ai_automation = job.get("ai_automation") or {}
    trigger_mode = (ai_automation.get("trigger_mode") or "deadline").lower()
    return bool(ai_automation.get("enabled")) and trigger_mode in {"deadline", "both"}


def _resolve_quiz_duration_minutes(value: Any) -> int:
    try:
        duration_minutes = int(value)
    except (TypeError, ValueError):
        return DEFAULT_QUIZ_DURATION_MINUTES

    return max(1, min(MAX_QUIZ_DURATION_MINUTES, duration_minutes))


def _normalize_vector_score(raw_similarity: float) -> float:
    if raw_similarity <= VECTOR_THRESHOLD:
        return 0.0
    return min(1.0, max(0.0, (raw_similarity - VECTOR_THRESHOLD) / (1.0 - VECTOR_THRESHOLD)))


def _cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0

    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for left_value, right_value in zip(left, right):
        dot += left_value * right_value
        left_norm += left_value * left_value
        right_norm += right_value * right_value

    if left_norm <= 0 or right_norm <= 0:
        return 0.0

    return dot / math.sqrt(left_norm * right_norm)


def _merge_candidate_profile(application: Dict[str, Any], candidate: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    profile_snapshot = application.get("profile_snapshot") or {}
    merged = {**(candidate or {}), **profile_snapshot}

    if candidate:
        if not merged.get("firstName"):
            merged["firstName"] = candidate.get("firstName") or candidate.get("prenom")
        if not merged.get("lastName"):
            merged["lastName"] = candidate.get("lastName") or candidate.get("nom")
        if not merged.get("email"):
            merged["email"] = candidate.get("email")

    return merged


async def _load_candidate_for_application(
    db: AsyncIOMotorDatabase,
    application: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    candidate_id = application.get("candidate_id") or application.get("user_id")
    if not candidate_id:
        return None

    candidate = await db.candidates.find_one({"user_id": candidate_id})
    if candidate:
        return candidate

    if ObjectId.is_valid(str(candidate_id)):
        return await db.candidates.find_one({"_id": ObjectId(str(candidate_id))})

    return None


async def _ensure_job_embedding(
    db: AsyncIOMotorDatabase,
    ai_service: AIMatchingService,
    job: Dict[str, Any],
) -> List[float]:
    embedding = job.get("embedding")
    if isinstance(embedding, list) and embedding:
        return embedding

    description = (job.get("description") or "").strip()
    if not description:
        return []

    embedding = await ai_service.generate_embedding(description)
    if embedding:
        await db.hr_jobs.update_one(
            {"_id": job["_id"]},
            {"$set": {"embedding": embedding, "updated_at": datetime.utcnow()}},
        )

    return embedding or []


async def _ensure_candidate_embedding(
    db: AsyncIOMotorDatabase,
    ai_service: AIMatchingService,
    candidate_doc: Optional[Dict[str, Any]],
    merged_profile: Dict[str, Any],
) -> List[float]:
    existing_embedding = candidate_doc.get("embedding") if candidate_doc else None
    if isinstance(existing_embedding, list) and existing_embedding:
        return existing_embedding

    candidate_text = ai_service._extract_text_for_embedding(merged_profile)
    if not candidate_text or candidate_text == "Profil vide.":
        return []

    embedding = await ai_service.generate_embedding(candidate_text)
    if embedding and candidate_doc and candidate_doc.get("_id"):
        await db.candidates.update_one(
            {"_id": candidate_doc["_id"]},
            {"$set": {"embedding": embedding}},
        )

    return embedding or []


def _scale_question_types(question_types: Dict[str, Dict[str, Any]], total_questions: int) -> Dict[str, Dict[str, Any]]:
    if total_questions <= 1:
        return {"mcq": {"count": 1, "options_count": 4}}

    base_items = [(name, config) for name, config in question_types.items() if (config or {}).get("count", 0) > 0]
    if not base_items:
        return {
            "mcq": {"count": max(1, total_questions - 1), "options_count": 4},
            "tf": {"count": 1},
        }

    current_total = sum(config.get("count", 0) for _, config in base_items)
    if current_total <= 0:
        return {
            "mcq": {"count": max(1, total_questions - 1), "options_count": 4},
            "tf": {"count": 1},
        }

    scaled: Dict[str, Dict[str, Any]] = {}
    remaining = total_questions
    for index, (name, config) in enumerate(base_items):
        if index == len(base_items) - 1:
            count = remaining
        else:
            ratio = config.get("count", 0) / current_total
            count = max(0, round(total_questions * ratio))
            remaining -= count

        if count <= 0:
            continue

        next_config = dict(config)
        next_config["count"] = count
        if name == "mcq" and "options_count" not in next_config:
            next_config["options_count"] = 4
        scaled[name] = next_config

    assigned = sum(config.get("count", 0) for config in scaled.values())
    if assigned != total_questions:
        diff = total_questions - assigned
        first_key = next(iter(scaled), "mcq")
        if first_key not in scaled:
            scaled[first_key] = {"count": 0, "options_count": 4}
        scaled[first_key]["count"] = max(1, scaled[first_key].get("count", 0) + diff)

    return scaled


async def _build_notification_metadata(
    db: AsyncIOMotorDatabase,
    application: Dict[str, Any],
    job: Dict[str, Any],
) -> Dict[str, Any]:
    metadata = {"job_title": job.get("title", "Poste sans titre")}
    company_id = job.get("company_id")
    if company_id:
        company = await db.hr_companies.find_one(
            {"_id": ObjectId(company_id) if ObjectId.is_valid(str(company_id)) else company_id}
        )
        if company:
            metadata["company_name"] = company.get("name", "Entreprise")

    return metadata


async def _notify_quiz_published(
    db: AsyncIOMotorDatabase,
    application: Dict[str, Any],
    job: Dict[str, Any],
    quiz_id: str,
    quiz: Dict[str, Any],
) -> None:
    candidate_id = application.get("candidate_id") or application.get("user_id")
    if not candidate_id:
        return

    metadata = await _build_notification_metadata(db, application, job)
    deadline = quiz.get("deadline")
    if deadline:
        metadata["deadline"] = deadline.isoformat() if isinstance(deadline, datetime) else str(deadline)

    await create_notification(
        db,
        user_id=str(candidate_id),
        title="Nouveau Quiz Disponible",
        message=f"Un quiz a ete genere pour votre candidature au poste de {quiz.get('title', 'Recrutement')}.",
        category="quiz",
        notification_type="info",
        link=f"/candidat/quiz/{quiz_id}",
        metadata=metadata,
    )


async def _notify_application_status_change(
    db: AsyncIOMotorDatabase,
    application: Dict[str, Any],
    job: Dict[str, Any],
    new_status: str,
) -> None:
    candidate_id = application.get("candidate_id") or application.get("user_id")
    if not candidate_id:
        return

    metadata = await _build_notification_metadata(db, application, job)
    await create_notification(
        db,
        user_id=str(candidate_id),
        title="Mise a jour de votre candidature",
        message=f"Le statut de votre candidature est passe a : {new_status}.",
        category="application",
        notification_type="info",
        link="/candidat/dashboard/applications",
        metadata=metadata,
    )


async def _create_and_publish_quiz(
    db: AsyncIOMotorDatabase,
    job: Dict[str, Any],
    application: Dict[str, Any],
    quiz_config: Dict[str, Any],
    *,
    run_id: str,
    quiz_key: str,
) -> str:
    app_id = _stringify_id(application.get("_id"))
    company_id = job.get("company_id")
    document_id = _stringify_id(quiz_config.get("document_id"))

    existing_quiz = await db.quizzes.find_one(
        {
            "application_id": app_id,
            "automation_run_id": run_id,
            "automation_quiz_key": quiz_key,
        }
    )
    if existing_quiz:
        if existing_quiz.get("status") != "published":
            published_at = datetime.utcnow()
            await db.quizzes.update_one(
                {"_id": existing_quiz["_id"]},
                {"$set": {"status": "published", "published_at": published_at, "updated_at": published_at}},
            )
            await db.job_applications.update_one(
                {"_id": application["_id"]},
                {"$set": {"quiz_status": "sent", "last_quiz_sent_at": published_at}},
            )
            refreshed_quiz = await db.quizzes.find_one({"_id": existing_quiz["_id"]})
            await _notify_quiz_published(db, application, job, _stringify_id(existing_quiz["_id"]), refreshed_quiz or existing_quiz)
        return _stringify_id(existing_quiz["_id"])

    if not ObjectId.is_valid(document_id):
        raise ValueError(f"Invalid document ID for automation quiz: {document_id}")

    document = await db.quiz_documents.find_one({"_id": ObjectId(document_id)})
    if not document:
        raise ValueError(f"Quiz document not found: {document_id}")

    if document.get("company_id") and company_id and document.get("company_id") != company_id:
        raise PermissionError(f"Quiz document {document_id} does not belong to company {company_id}")

    if document.get("status") != "ready" and not quiz_generation_is_mock():
        raise RuntimeError(f"Quiz document {document_id} is not ready (status={document.get('status')})")

    total_questions = int(quiz_config.get("total_questions") or 10)
    difficulty_mix = quiz_config.get("difficulty_mix") or {"easy": 0.4, "medium": 0.4, "hard": 0.2}
    config = resolve_template_config(
        None,
        {
            "total_questions": total_questions,
            "difficulty_mix": difficulty_mix,
        },
    )
    config["question_types"] = _scale_question_types(config.get("question_types", {}), total_questions)

    chunks = await retrieve_chunks_for_quiz(
        db,
        document_id,
        total_questions=total_questions,
        section_filter=config.get("sections_filter"),
        max_chunk_reuse=config.get("max_chunk_reuse", 3),
    )
    if not chunks:
        raise RuntimeError(f"No chunks available for automation quiz document {document_id}")

    question_types = {question_type: settings["count"] for question_type, settings in config["question_types"].items()}
    quiz_title = (quiz_config.get("title") or document.get("title") or document.get("filename") or "Quiz Technique").strip()

    quiz_data = await generate_quiz(
        chunks=chunks,
        question_types=question_types,
        difficulty_mix=difficulty_mix,
        title=quiz_title,
        options_count=config["question_types"].get("mcq", {}).get("options_count", 4),
    )

    quiz_data["document_id"] = ObjectId(document_id)
    quiz_data["template_id"] = None
    quiz_data["generated_by"] = "system"
    quiz_data["company_id"] = company_id
    quiz_data["application_id"] = app_id
    quiz_data["duration_minutes"] = _resolve_quiz_duration_minutes(quiz_config.get("duration_minutes"))
    quiz_data["status"] = "draft"
    quiz_data["automation_run_id"] = run_id
    quiz_data["automation_quiz_key"] = quiz_key
    quiz_data["automation_job_id"] = _stringify_id(job.get("_id"))
    quiz_data["auto_generated"] = True
    quiz_data["weight_percentage"] = int(quiz_config.get("weight_percentage") or 0)

    deadline_at = _parse_datetime_value(quiz_config.get("deadline_at"))
    if deadline_at:
        quiz_data["deadline"] = deadline_at

    chunk_ids = quiz_data.get("source_chunk_ids", [])
    overlap = await compute_overlap_with_existing(db, document_id, chunk_ids)
    quiz_data["overlap_score"] = overlap

    validation_errors = validate_quiz_output(quiz_data, config)
    if validation_errors:
        logger.warning("Automation quiz validation warnings for app=%s, quiz_key=%s: %s", app_id, quiz_key, validation_errors)

    insert_result = await db.quizzes.insert_one(quiz_data)
    quiz_id = _stringify_id(insert_result.inserted_id)
    question_types_used = list(set(question.get("type") for question in quiz_data.get("questions", [])))
    await update_chunk_usage(db, chunk_ids, question_types_used)
    await record_quiz_provenance(db, quiz_id, document_id, chunk_ids, template_id=None, user_id="system")

    published_at = datetime.utcnow()
    await db.quizzes.update_one(
        {"_id": insert_result.inserted_id},
        {"$set": {"status": "published", "published_at": published_at, "updated_at": published_at}},
    )
    await db.job_applications.update_one(
        {"_id": application["_id"]},
        {"$set": {"quiz_status": "sent", "last_quiz_sent_at": published_at}},
    )

    stored_quiz = await db.quizzes.find_one({"_id": insert_result.inserted_id})
    await _notify_quiz_published(db, application, job, quiz_id, stored_quiz or quiz_data)
    return quiz_id


async def run_deadline_automation_for_job(
    db: AsyncIOMotorDatabase,
    job: Dict[str, Any],
    *,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    now = now or datetime.now()
    job_id = _stringify_id(job.get("_id"))
    job_description = (job.get("description") or "").strip()
    ai_automation = job.get("ai_automation") or {}
    vector_filter = ai_automation.get("vector_filter") or {}
    ai_score_filter = ai_automation.get("ai_score_filter") or {}
    quiz_stage = ai_automation.get("quiz_stage") or {}
    quiz_configs = quiz_stage.get("quizzes") or []

    applications = await db.job_applications.find({"job_id": job_id}).to_list(length=500)
    run_id = job.get("ai_automation_run_id") or f"deadline-{job_id}-{int(now.timestamp())}"
    if not applications:
        return {
            "job_id": job_id,
            "run_id": run_id,
            "applications_considered": 0,
            "vector_shortlist_count": 0,
            "ai_shortlist_count": 0,
            "quizzes_published": 0,
            "promoted_to_interview": [],
        }

    ai_service = AIMatchingService(db=db)
    try:
        job_embedding = await _ensure_job_embedding(db, ai_service, job)
        job_skills = _extract_skills_from_job(job)
        ai_engine = get_ai_engine()

        sem_embed = asyncio.Semaphore(_EMBED_CONCURRENCY)

        async def _vectorize_one(application):
            async with sem_embed:
                candidate_doc = await _load_candidate_for_application(db, application)
                merged_profile = _merge_candidate_profile(application, candidate_doc)
                candidate_embedding = await _ensure_candidate_embedding(db, ai_service, candidate_doc, merged_profile)
            raw_similarity = _cosine_similarity(job_embedding, candidate_embedding) if job_embedding and candidate_embedding else 0.0
            vector_score = round(_normalize_vector_score(raw_similarity) * 100, 2)

            cnn_score = 0
            try:
                c_skills = _extract_skills_from_candidate(merged_profile)
                if c_skills and job_skills:
                    cnn_score = ai_engine.job_match_score(c_skills, job_skills).get("score", 0)
            except Exception as _cnn_err:
                logger.warning("[Job Automation] CNN score failed for application %s: %s", _stringify_id(application.get("_id")), _cnn_err)

            composite_score = min(100, round(cnn_score + (vector_score / 10)))
            return {
                "application": application,
                "candidate_doc": candidate_doc,
                "merged_profile": merged_profile,
                "vector_score": vector_score,
                "cnn_score": cnn_score,
                "composite_score": composite_score,
                "raw_similarity": raw_similarity,
            }

        ranked_by_vector: List[Dict[str, Any]] = list(
            await asyncio.gather(*[_vectorize_one(app) for app in applications])
        )

        ranked_by_vector.sort(
            key=lambda item: (
                item["composite_score"],
                item["vector_score"],
                _parse_datetime_value(item["application"].get("applied_at")) or datetime.min,
                _stringify_id(item["application"].get("_id")),
            ),
            reverse=True,
        )

        top_x = int(vector_filter.get("top_x_candidates") or len(ranked_by_vector))
        vector_shortlist = ranked_by_vector[:top_x]

        sem_llm = asyncio.Semaphore(_LLM_CONCURRENCY)

        async def _llm_score_one(rank: int, item: Dict[str, Any]) -> Dict[str, Any]:
            application = item["application"]
            app_id = _stringify_id(application.get("_id"))
            existing_justification = application.get("ai_justification")

            # Use the composite score (CNN + semantic) as the primary score — same formula as HR view
            ai_score = item["composite_score"]

            if existing_justification:
                justification = existing_justification
            else:
                async with sem_llm:
                    analysis = await ai_service.evaluate_candidate_with_llm(job_description, item["merged_profile"])
                justification = analysis.get("justification", "")

            await db.job_applications.update_one(
                {"_id": application["_id"]},
                {
                    "$set": {
                        "status": "in_review",
                        "updated_at": datetime.utcnow(),
                        "vector_match_score": item["vector_score"],
                        "vector_matched_at": datetime.utcnow(),
                        "llm_score": item["vector_score"],
                        "cnn_score": item["cnn_score"],
                        "ai_score": ai_score,
                        "ai_justification": justification,
                        "ai_evaluated_at": datetime.utcnow(),
                        "automation_run_id": run_id,
                        "automation_vector_rank": rank,
                    }
                },
            )
            logger.info(
                "[Job Automation] Scored application %s for job %s: composite=%s (cnn=%s, embed=%s)",
                app_id, job_id, ai_score, item["cnn_score"], item["vector_score"],
            )
            return {**item, "ai_score": ai_score, "ai_justification": justification}

        ai_ranked: List[Dict[str, Any]] = list(await asyncio.gather(*[
            _llm_score_one(rank, item)
            for rank, item in enumerate(vector_shortlist, start=1)
        ]))

        ai_ranked.sort(
            key=lambda item: (
                item["ai_score"],
                item["composite_score"],
                item["vector_score"],
                _parse_datetime_value(item["application"].get("applied_at")) or datetime.min,
                _stringify_id(item["application"].get("_id")),
            ),
            reverse=True,
        )

        top_y = int(ai_score_filter.get("top_y_candidates") or len(ai_ranked))
        ai_shortlist = ai_ranked[:top_y]

        quiz_stage_enabled = bool(quiz_stage.get("enabled")) and bool(quiz_configs)
        published_quiz_count = 0
        promoted_application_ids: List[str] = []

        if quiz_stage_enabled:
            for rank, item in enumerate(ai_shortlist, start=1):
                application = item["application"]
                app_id = _stringify_id(application.get("_id"))
                previous_status = application.get("status")

                await db.job_applications.update_one(
                    {"_id": application["_id"]},
                    {
                        "$set": {
                            "status": "technical_test",
                            "updated_at": datetime.utcnow(),
                            "automation_run_id": run_id,
                            "automation_ai_rank": rank,
                            "automation_vector_score": item["vector_score"],
                            "automation_ai_score": item["ai_score"],
                        }
                    },
                )
                if previous_status != "technical_test":
                    await _notify_application_status_change(db, application, job, "technical_test")

                for quiz_index, quiz_config in enumerate(quiz_configs):
                    quiz_key = f"quiz-{quiz_index}"
                    await _create_and_publish_quiz(
                        db,
                        job,
                        application,
                        quiz_config,
                        run_id=run_id,
                        quiz_key=quiz_key,
                    )
                    published_quiz_count += 1

                logger.info("[Job Automation] Published %s quiz(es) for application %s", len(quiz_configs), app_id)
        elif ai_shortlist:
            top_z = int(quiz_stage.get("approve_top_z_to_interview") or len(ai_shortlist))
            immediate_interview_shortlist = ai_shortlist[:top_z]
            for rank, item in enumerate(immediate_interview_shortlist, start=1):
                application = item["application"]
                previous_status = application.get("status")
                promoted_application_ids.append(_stringify_id(application.get("_id")))
                await db.job_applications.update_one(
                    {"_id": application["_id"]},
                    {
                        "$set": {
                            "status": "interview",
                            "updated_at": datetime.utcnow(),
                            "automation_run_id": run_id,
                            "automation_interview_rank": rank,
                            "automation_vector_score": item["vector_score"],
                            "automation_ai_score": item["ai_score"],
                            "automation_final_score": item["ai_score"],
                        }
                    },
                )
                if previous_status != "interview":
                    await _notify_application_status_change(db, application, job, "interview")

        return {
            "job_id": job_id,
            "run_id": run_id,
            "applications_considered": len(applications),
            "vector_shortlist_count": len(vector_shortlist),
            "ai_shortlist_count": len(ai_shortlist),
            "quizzes_published": published_quiz_count,
            "promoted_to_interview": promoted_application_ids,
        }
    finally:
        await ai_service.close()


def calculate_weighted_quiz_score(quizzes: List[Dict[str, Any]]) -> float:
    total_score = 0.0
    total_weight = 0.0

    for quiz in quizzes:
        weight = float(quiz.get("weight_percentage") or 0)
        if weight <= 0:
            continue

        total_weight += weight
        score = float(quiz.get("score") or 0.0)
        total_score += score * (weight / 100.0)

    if total_weight <= 0:
        return 0.0

    return round(total_score, 2)


async def finalize_quiz_stage_for_job(
    db: AsyncIOMotorDatabase,
    job: Dict[str, Any],
    *,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    now = now or datetime.now()
    job_id = _stringify_id(job.get("_id"))
    run_id = job.get("ai_automation_run_id") or f"deadline-{job_id}"
    ai_automation = job.get("ai_automation") or {}
    quiz_stage = ai_automation.get("quiz_stage") or {}
    top_z = int(quiz_stage.get("approve_top_z_to_interview") or 0)

    shortlisted_apps = await db.job_applications.find(
        {
            "job_id": job_id,
            "automation_run_id": run_id,
            "automation_ai_rank": {"$exists": True},
        }
    ).to_list(length=500)

    if not shortlisted_apps or top_z <= 0:
        return {
            "job_id": job_id,
            "run_id": run_id,
            "applications_evaluated": 0,
            "promoted_to_interview": [],
        }

    ranked_results: List[Dict[str, Any]] = []
    for application in shortlisted_apps:
        app_id = _stringify_id(application.get("_id"))
        quizzes = await db.quizzes.find(
            {
                "application_id": app_id,
                "automation_run_id": run_id,
                "auto_generated": True,
            }
        ).to_list(length=100)

        latest_quiz_by_key: Dict[str, Dict[str, Any]] = {}
        for quiz in quizzes:
            quiz_key = quiz.get("automation_quiz_key") or _stringify_id(quiz.get("_id"))
            current = latest_quiz_by_key.get(quiz_key)
            current_submitted_at = _parse_datetime_value(current.get("submitted_at")) if current else None
            candidate_submitted_at = _parse_datetime_value(quiz.get("submitted_at"))
            current_updated_at = _parse_datetime_value(current.get("updated_at")) if current else None
            candidate_updated_at = _parse_datetime_value(quiz.get("updated_at"))
            current_sort = current_submitted_at or current_updated_at or datetime.min
            candidate_sort = candidate_submitted_at or candidate_updated_at or datetime.min
            if current is None or candidate_sort >= current_sort:
                latest_quiz_by_key[quiz_key] = quiz

        weighted_score = calculate_weighted_quiz_score(list(latest_quiz_by_key.values()))
        ranked_results.append(
            {
                "application": application,
                "weighted_score": weighted_score,
                "ai_score": float(application.get("ai_score") or 0),
                "vector_score": float(
                    application.get("automation_vector_score")
                    or application.get("vector_match_score")
                    or 0
                ),
                "quiz_count": len(latest_quiz_by_key),
            }
        )

    ranked_results.sort(
        key=lambda item: (
            item["weighted_score"],
            item["ai_score"],
            item["vector_score"],
            _parse_datetime_value(item["application"].get("applied_at")) or datetime.min,
            _stringify_id(item["application"].get("_id")),
        ),
        reverse=True,
    )

    promoted_ids: List[str] = []
    for rank, item in enumerate(ranked_results, start=1):
        application = item["application"]
        app_id = _stringify_id(application.get("_id"))
        should_promote = rank <= top_z
        new_status = "interview" if should_promote else application.get("status") or "technical_test"
        if should_promote:
            promoted_ids.append(app_id)

        await db.job_applications.update_one(
            {"_id": application["_id"]},
            {
                "$set": {
                    "status": new_status,
                    "updated_at": datetime.utcnow(),
                    "quiz_score": item["weighted_score"],
                    "automation_final_score": item["weighted_score"],
                    "automation_interview_rank": rank if should_promote else None,
                    "automation_finalized_at": now,
                }
            },
        )

        if should_promote and application.get("status") != "interview":
            await _notify_application_status_change(db, application, job, "interview")

    return {
        "job_id": job_id,
        "run_id": run_id,
        "applications_evaluated": len(ranked_results),
        "promoted_to_interview": promoted_ids,
    }
