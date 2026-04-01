from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from utils.files import resolve_file

router = APIRouter(prefix="/candidates", tags=["HR Candidates"])

ALLOWED_RATING_ROLES = {"admin", "recruiter", "chef_departement", "hr"}
ALLOWED_VERIFICATION_STATUSES = {"pending", "verified", "rejected"}
QUALIFICATION_CONFIG = {
    "experiences": {
        "document_field": "document",
        "link_fields": (),
        "fallback_filename": "experience-document.pdf",
    },
    "educations": {
        "document_field": "certificate",
        "link_fields": ("socialLink",),
        "fallback_filename": "education-certificate.pdf",
    },
    "certificates": {
        "document_field": "document",
        "link_fields": ("url",),
        "fallback_filename": "certificate.pdf",
    },
}


class CandidateRatingPayload(BaseModel):
    rate: int = Field(..., ge=1, le=5)


class QualificationVerificationPayload(BaseModel):
    status: str = Field(..., pattern="^(pending|verified|rejected)$")
    note: str = Field(default="", max_length=2000)


def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]


def serialize_mongo(obj):
    """Recursively convert ObjectId, datetime, and bytes to JSON-safe values."""
    if isinstance(obj, list):
        return [serialize_mongo(item) for item in obj]
    if isinstance(obj, dict):
        return {key: serialize_mongo(value) for key, value in obj.items()}
    if isinstance(obj, (ObjectId, datetime)):
        return str(obj)
    if isinstance(obj, bytes):
        return "[Binary Data]"
    return obj


def sanitize_candidate_assets(candidate: dict) -> dict:
    """Strip legacy binary blobs from documents before serialising."""
    if not isinstance(candidate, dict):
        return candidate

    if isinstance(candidate.get("cv"), dict):
        cv_copy = dict(candidate["cv"])
        cv_copy.pop("file_data", None)
        candidate["cv"] = cv_copy

    for category, config in QUALIFICATION_CONFIG.items():
        document_field = config["document_field"]
        cleaned_items = []
        source_items = candidate.get(category, [])
        if not isinstance(source_items, list):
            candidate[category] = []
            continue

        for item in source_items:
            if not isinstance(item, dict):
                cleaned_items.append(item)
                continue

            item_copy = dict(item)
            document = item_copy.get(document_field)
            if isinstance(document, dict):
                document_copy = dict(document)
                document_copy.pop("file_data", None)
                item_copy[document_field] = document_copy
            cleaned_items.append(item_copy)

        candidate[category] = cleaned_items

    return candidate


def normalize_verification_map(candidate: dict) -> Dict[str, Dict[str, dict]]:
    raw_map = candidate.get("qualification_verifications", {})
    if not isinstance(raw_map, dict):
        raw_map = {}

    normalized: Dict[str, Dict[str, dict]] = {}
    for category in QUALIFICATION_CONFIG:
        category_map = raw_map.get(category, {})
        if not isinstance(category_map, dict):
            category_map = {}
        normalized[category] = {
            str(item_id): value
            for item_id, value in category_map.items()
            if isinstance(value, dict)
        }

    return normalized


def build_verification_response(record: Optional[dict]) -> dict:
    if not isinstance(record, dict):
        return {
            "status": "pending",
            "note": "",
            "created_at": None,
            "updated_at": None,
            "reviewed_by": None,
            "has_review": False,
        }

    return serialize_mongo({
        "status": record.get("status") if record.get("status") in ALLOWED_VERIFICATION_STATUSES else "pending",
        "note": record.get("note") or "",
        "created_at": record.get("created_at"),
        "updated_at": record.get("updated_at"),
        "reviewed_by": record.get("reviewed_by") if isinstance(record.get("reviewed_by"), dict) else None,
        "has_review": True,
    })


def get_reviewer_identity(db, current_user: dict) -> dict:
    hr_profile = (
        db.hr_profiles.find_one({"_id": current_user["id"]})
        or db.hr_profiles.find_one({"id": current_user["id"]})
        or {}
    )

    first_name = hr_profile.get("first_name") or hr_profile.get("firstName") or ""
    last_name = hr_profile.get("last_name") or hr_profile.get("lastName") or ""
    full_name = f"{first_name} {last_name}".strip() or current_user.get("email") or "HR"

    return {
        "id": current_user["id"],
        "email": current_user.get("email", ""),
        "name": full_name,
        "role": current_user.get("role", ""),
    }


def find_candidate_document(db, candidate_id: str):
    candidate = None
    if ObjectId.is_valid(candidate_id):
        candidate = db.candidates.find_one({"_id": ObjectId(candidate_id)})
    if not candidate:
        candidate = db.candidates.find_one({"user_id": candidate_id})
    return candidate


def ensure_qualification_item_ids(db, candidate: dict) -> dict:
    updates: Dict[str, Any] = {}

    for category in QUALIFICATION_CONFIG:
        items = candidate.get(category, [])
        if not isinstance(items, list):
            continue

        normalized_items = []
        category_changed = False

        for item in items:
            if not isinstance(item, dict):
                normalized_items.append(item)
                continue

            item_copy = dict(item)
            if not item_copy.get("id"):
                item_copy["id"] = uuid4().hex
                category_changed = True
            normalized_items.append(item_copy)

        if category_changed:
            candidate[category] = normalized_items
            updates[category] = normalized_items

    if updates:
        updates["updated_at"] = datetime.utcnow()
        db.candidates.update_one({"_id": candidate["_id"]}, {"$set": updates})

    return candidate


def get_qualification_item(candidate: dict, category: str, item_id: str) -> Optional[dict]:
    for item in candidate.get(category, []):
        if isinstance(item, dict) and str(item.get("id")) == str(item_id):
            return item
    return None


def build_qualification_proof(candidate_id: str, category: str, item: dict) -> dict:
    config = QUALIFICATION_CONFIG[category]
    document_field = config["document_field"]
    document = item.get(document_field) if isinstance(item, dict) else None
    document_info = document if isinstance(document, dict) else None
    resolved_document = resolve_file(document_info) if document_info else None
    has_legacy_binary = bool(document_info and document_info.get("file_data"))
    has_retrievable_file = bool(resolved_document or has_legacy_binary)

    external_url = None
    for field_name in config.get("link_fields", ()):
        field_value = item.get(field_name) if isinstance(item, dict) else None
        if isinstance(field_value, str) and field_value.strip():
            external_url = field_value.strip()
            break

    item_id = str(item.get("id")) if isinstance(item, dict) and item.get("id") is not None else None
    filename = None
    if document_info:
        filename = (
            document_info.get("filename")
            or item.get("documentName")
            or item.get("certificateName")
            or item.get("fileName")
        )

    return {
        "available": bool(has_retrievable_file or external_url),
        "has_file": has_retrievable_file,
        "has_link": bool(external_url),
        "missing_file": bool(document_info and not has_retrievable_file),
        "file_name": filename,
        "download_url": (
            f"/api/candidates/{candidate_id}/qualifications/{category}/{item_id}/document"
            if candidate_id and item_id and has_retrievable_file
            else None
        ),
        "external_url": external_url,
    }


def has_verifiable_proof(category: str, item: dict) -> bool:
    proof = build_qualification_proof("", category, item)
    return bool(proof.get("available"))


def decorate_qualification_items(
    candidate_id: str,
    items: list,
    category: str,
    verification_map: Dict[str, dict],
) -> List[dict]:
    decorated_items: List[dict] = []

    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue

        item_id = str(item.get("id")) if item.get("id") is not None else None
        serialized_item = serialize_mongo(item)
        serialized_item["id"] = item_id
        serialized_item["proof"] = build_qualification_proof(candidate_id, category, item)
        serialized_item["verification"] = build_verification_response(
            verification_map.get(item_id) if item_id else None
        )
        decorated_items.append(serialized_item)

    return decorated_items


def build_qualification_summary(qualifications: Dict[str, List[dict]]) -> dict:
    summary = {
        "total_items": 0,
        "with_proof": 0,
        "verified": 0,
        "rejected": 0,
        "pending": 0,
        "needs_proof": 0,
        "by_category": {},
    }

    for category in QUALIFICATION_CONFIG:
        items = qualifications.get(category, [])
        total_items = len(items)
        with_proof = sum(1 for item in items if item.get("proof", {}).get("available"))
        verified = sum(1 for item in items if item.get("verification", {}).get("status") == "verified")
        rejected = sum(1 for item in items if item.get("verification", {}).get("status") == "rejected")
        pending = max(total_items - verified - rejected, 0)
        needs_proof = max(total_items - with_proof, 0)

        summary["by_category"][category] = {
            "total_items": total_items,
            "with_proof": with_proof,
            "verified": verified,
            "rejected": rejected,
            "pending": pending,
            "needs_proof": needs_proof,
        }
        summary["total_items"] += total_items
        summary["with_proof"] += with_proof
        summary["verified"] += verified
        summary["rejected"] += rejected
        summary["pending"] += pending
        summary["needs_proof"] += needs_proof

    return summary


def build_candidate_qualification_bundle(candidate_id: str, candidate: dict):
    verification_maps = normalize_verification_map(candidate)
    qualifications = {
        category: decorate_qualification_items(
            candidate_id,
            candidate.get(category, []),
            category,
            verification_maps.get(category, {}),
        )
        for category in QUALIFICATION_CONFIG
    }
    return qualifications, verification_maps, build_qualification_summary(qualifications)


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
            None,
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
    limit: int = 100,
):
    """
    Returns all candidate profiles decorated with their best matching job info.
    """
    try:
        db = get_db()
        candidates_cursor = db.candidates.find({}).skip(skip).limit(limit)
        raw_candidates = list(candidates_cursor)

        enriched_candidates = []
        for cand in raw_candidates:
            candidate_id = cand.get("user_id") or str(cand.get("_id"))

            best_app = db.job_applications.find_one(
                {"$or": [{"candidate_id": candidate_id}, {"user_id": candidate_id}]},
                sort=[("ai_score", -1)],
            )

            if best_app:
                cand["score"] = best_app.get("ai_score") or best_app.get("score") or 0

                job_id = best_app.get("job_id")
                if job_id:
                    job_query = {"_id": ObjectId(job_id)} if ObjectId.is_valid(str(job_id)) else {"_id": job_id}
                    job = db.hr_jobs.find_one(job_query)
                    if job:
                        cand["best_match_job"] = job.get("title") or "Job sans titre"
                    else:
                        cand["best_match_job"] = "Job inconnu"
                else:
                    cand["best_match_job"] = "Non assigne"
            else:
                cand["score"] = 0
                cand["best_match_job"] = "Aucune candidature"

            enriched_candidates.append(cand)

        return serialize_mongo(enriched_candidates)
    except Exception as exc:
        import traceback

        print(f"ERROR in get_all_candidates: {str(exc)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(exc)}")


@router.get("/{candidate_id}")
async def get_candidate_detail(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns a single candidate profile enriched with live qualification data,
    application history, and HR verification state.
    """
    try:
        db = get_db()
        candidate = find_candidate_document(db, candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        candidate = ensure_qualification_item_ids(db, candidate)
        candidate = sanitize_candidate_assets(candidate)

        c_id = candidate.get("user_id") or str(candidate.get("_id"))

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
            candidate["profileImage"] = (
                candidate.get("profileImage")
                or candidate.get("profilePicture")
                or candidate.get("avatar")
                or user.get("profileImage")
                or ""
            )

        applications = list(
            db.candidat_applications.find(
                {"$or": [{"candidate_id": c_id}, {"user_id": c_id}]}
            ).sort("ai_score", -1)
        )

        if not applications:
            applications = list(
                db.job_applications.find(
                    {"$or": [{"candidate_id": c_id}, {"user_id": c_id}]}
                ).sort("ai_score", -1)
            )

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
                "certificates": app.get("profile_snapshot", {}).get("certificates", []) or candidate.get("certificates", []),
            })

        best_app = enriched_apps[0] if enriched_apps else None
        live_skills = candidate.get("skills", [])
        qualification_data, verification_maps, verification_summary = build_candidate_qualification_bundle(c_id, candidate)

        result = {
            **serialize_mongo(candidate),
            "applications": serialize_mongo(enriched_apps),
            "best_score": best_app["ai_score"] if best_app else 0,
            "best_match_job": best_app["job_title"] if best_app else "Aucune candidature",
            "ai_justification": best_app["ai_justification"] if best_app else "",
            "skills": serialize_mongo(live_skills or (best_app["skills"] if best_app else [])),
            "experiences": qualification_data["experiences"],
            "educations": qualification_data["educations"],
            "certificates": qualification_data["certificates"],
            "qualification_verifications": serialize_mongo(verification_maps),
            "qualification_verification_summary": verification_summary,
            **build_candidate_rating_meta(candidate, current_user.get("id")),
        }

        return result
    except HTTPException:
        raise
    except Exception as exc:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/{candidate_id}/rating")
async def upsert_candidate_rating(
    candidate_id: str,
    payload: CandidateRatingPayload,
    current_user: dict = Depends(get_current_user),
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

        reviewer = get_reviewer_identity(db, current_user)

        ratings = candidate.get("ratings", [])
        ratings = ratings if isinstance(ratings, list) else []
        now = datetime.utcnow()

        new_rating = {
            "hr_id": reviewer["id"],
            "hr_email": reviewer["email"],
            "hr_name": reviewer["name"],
            "hr_role": reviewer["role"],
            "rate": payload.rate,
            "updated_at": now,
        }

        existing_index = next(
            (index for index, rating in enumerate(ratings) if rating.get("hr_id") == current_user["id"]),
            None,
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
            {"$set": {"ratings": ratings, "updated_at": now}},
        )

        updated_candidate = find_candidate_document(db, candidate_id) or {**candidate, "ratings": ratings}
        return build_candidate_rating_meta(updated_candidate, current_user.get("id"))
    except HTTPException:
        raise
    except Exception as exc:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{candidate_id}/cv/download")
async def download_candidate_cv(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
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
    except Exception as exc:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{candidate_id}/qualifications/{category}/{item_id}/document")
async def download_candidate_qualification_document(
    candidate_id: str,
    category: str,
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Download a qualification proof document from the HR side.
    """
    try:
        if current_user.get("role") not in ALLOWED_RATING_ROLES:
            raise HTTPException(status_code=403, detail="You are not allowed to access candidate documents")
        if category not in QUALIFICATION_CONFIG:
            raise HTTPException(status_code=404, detail="Qualification category not found")

        db = get_db()
        candidate = find_candidate_document(db, candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        candidate = ensure_qualification_item_ids(db, candidate)
        item = get_qualification_item(candidate, category, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Qualification item not found")

        config = QUALIFICATION_CONFIG[category]
        document = item.get(config["document_field"])
        if not isinstance(document, dict):
            raise HTTPException(status_code=404, detail="Qualification proof document not found")

        resolved = resolve_file(document)
        if resolved:
            abs_path, content_type, filename = resolved
            return FileResponse(abs_path, media_type=content_type, filename=filename)

        if document.get("file_data"):
            filename = document.get("filename", config["fallback_filename"])
            return Response(
                content=bytes(document["file_data"]),
                media_type=document.get("content_type", "application/pdf"),
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

        raise HTTPException(status_code=404, detail="Qualification proof file not found")
    except HTTPException:
        raise
    except Exception as exc:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/{candidate_id}/qualifications/{category}/{item_id}/verification")
async def upsert_candidate_qualification_verification(
    candidate_id: str,
    category: str,
    item_id: str,
    payload: QualificationVerificationPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Save or update the current HR user's verification decision for a qualification item.
    """
    try:
        if current_user.get("role") not in ALLOWED_RATING_ROLES:
            raise HTTPException(status_code=403, detail="You are not allowed to verify candidate documents")
        if category not in QUALIFICATION_CONFIG:
            raise HTTPException(status_code=404, detail="Qualification category not found")

        db = get_db()
        candidate = find_candidate_document(db, candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        candidate = ensure_qualification_item_ids(db, candidate)
        item = get_qualification_item(candidate, category, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Qualification item not found")

        status_value = payload.status.strip().lower()
        if status_value not in ALLOWED_VERIFICATION_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid verification status")
        if status_value == "verified" and not has_verifiable_proof(category, item):
            raise HTTPException(
                status_code=400,
                detail="This qualification cannot be marked as verified because no proof was provided",
            )

        reviewer = get_reviewer_identity(db, current_user)
        verification_maps = normalize_verification_map(candidate)
        category_map = verification_maps.get(category, {})
        existing_record = category_map.get(str(item_id), {})
        now = datetime.utcnow()

        updated_record = {
            "status": status_value,
            "note": payload.note.strip(),
            "reviewed_by": reviewer,
            "created_at": existing_record.get("created_at") if isinstance(existing_record, dict) else now,
            "updated_at": now,
        }
        if not updated_record["created_at"]:
            updated_record["created_at"] = now

        category_map[str(item_id)] = updated_record
        verification_maps[category] = category_map
        candidate["qualification_verifications"] = verification_maps

        db.candidates.update_one(
            {"_id": candidate["_id"]},
            {
                "$set": {
                    "qualification_verifications": verification_maps,
                    "updated_at": now,
                }
            },
        )

        qualification_data, _, qualification_summary = build_candidate_qualification_bundle(
            candidate.get("user_id") or str(candidate.get("_id")),
            sanitize_candidate_assets(candidate),
        )
        updated_item = next(
            (entry for entry in qualification_data[category] if entry.get("id") == str(item_id)),
            None,
        )

        return {
            "category": category,
            "item_id": str(item_id),
            "verification": updated_item.get("verification") if updated_item else build_verification_response(updated_record),
            "qualification_verification_summary": qualification_summary,
        }
    except HTTPException:
        raise
    except Exception as exc:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))
