"""
Metadata Manager.
Tracks chunk usage, question types generated, and source provenance.
Implements heuristics to avoid repetition across quiz generations.

Key heuristics:
- Decay window: Skip chunks used within N days
- Max uses per chunk: Limit how many times a chunk can be used
- Jaccard overlap: Check source chunk overlap between quizzes
"""

import logging
from typing import List, Dict, Set, Optional
from datetime import datetime, timedelta

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


# ── Usage Tracking ───────────────────────────────────────────────────────────

async def update_chunk_usage(
    db: AsyncIOMotorDatabase,
    chunk_ids: List[str],
    question_types: Optional[List[str]] = None
):
    """
    Update usage_count and last_used_at for chunks used in quiz generation.

    Args:
        db: Async MongoDB database.
        chunk_ids: List of chunk _id strings that were used.
        question_types: List of question types generated from these chunks.
    """
    if not chunk_ids:
        return

    now = datetime.utcnow()
    oids = [ObjectId(cid) if isinstance(cid, str) else cid for cid in chunk_ids]

    update_fields = {
        "$inc": {"usage_count": 1},
        "$set": {"last_used_at": now}
    }

    if question_types:
        update_fields["$addToSet"] = {
            "question_types_generated": {"$each": question_types}
        }

    result = await db.quiz_chunks.update_many(
        {"_id": {"$in": oids}},
        update_fields
    )
    logger.info(f"Updated usage for {result.modified_count} chunks")


async def record_quiz_provenance(
    db: AsyncIOMotorDatabase,
    quiz_id: str,
    document_id: str,
    chunk_ids: List[str],
    template_id: Optional[str] = None,
    user_id: str = "system"
):
    """
    Record an audit entry for a quiz generation event.
    Stores the quiz → chunk provenance chain.
    """
    audit_entry = {
        "action": "quiz_generated",
        "user_id": user_id,
        "timestamp": datetime.utcnow(),
        "details": {
            "quiz_id": quiz_id,
            "document_id": document_id,
            "template_id": template_id,
            "chunk_ids": chunk_ids,
            "metadata": {
                "total_chunks_used": len(chunk_ids),
                "unique_chunks": len(set(chunk_ids)),
            }
        }
    }
    await db.quiz_audit.insert_one(audit_entry)
    logger.info(f"Recorded audit for quiz {quiz_id}")


# ── Repetition Heuristics ────────────────────────────────────────────────────

def compute_jaccard_overlap(set_a: Set[str], set_b: Set[str]) -> float:
    """
    Compute Jaccard similarity between two sets of chunk IDs.
    Returns a value between 0.0 (no overlap) and 1.0 (identical).

    Example:
        >>> compute_jaccard_overlap({"a", "b", "c"}, {"b", "c", "d"})
        0.5
    """
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union)


async def compute_overlap_with_existing(
    db: AsyncIOMotorDatabase,
    document_id: str,
    new_chunk_ids: List[str],
    window_days: int = 30,
    max_quizzes: int = 10
) -> float:
    """
    Compute the average source chunk overlap between a new quiz
    and recently generated quizzes from the same document.

    Returns average Jaccard overlap (0.0–1.0).
    Target: < 0.10 (10%) for good diversity.
    """
    doc_oid = ObjectId(document_id) if isinstance(document_id, str) else document_id
    cutoff = datetime.utcnow() - timedelta(days=window_days)

    # Fetch recent quizzes from same document
    recent_quizzes = await db.quizzes.find(
        {
            "document_id": doc_oid,
            "generated_at": {"$gte": cutoff}
        },
        {"source_chunk_ids": 1}
    ).sort("generated_at", -1).to_list(length=max_quizzes)

    if not recent_quizzes:
        return 0.0

    new_set = set(str(cid) for cid in new_chunk_ids)
    overlaps = []

    for quiz in recent_quizzes:
        existing_set = set(str(cid) for cid in quiz.get("source_chunk_ids", []))
        overlap = compute_jaccard_overlap(new_set, existing_set)
        overlaps.append(overlap)

    avg_overlap = sum(overlaps) / len(overlaps) if overlaps else 0.0
    logger.info(f"Average overlap with {len(recent_quizzes)} recent quizzes: {avg_overlap:.3f}")
    return avg_overlap


async def check_chunk_availability(
    db: AsyncIOMotorDatabase,
    document_id: str,
    max_usage: int = 3,
    decay_days: int = 30
) -> Dict:
    """
    Check how many chunks are available for quiz generation,
    given usage limits and decay windows.

    Returns stats dict:
    {
        "total_chunks": int,
        "available_chunks": int,
        "exhausted_chunks": int,
        "recently_used_chunks": int,
        "sections": {section_name: available_count}
    }
    """
    doc_oid = ObjectId(document_id) if isinstance(document_id, str) else document_id
    cutoff = datetime.utcnow() - timedelta(days=decay_days)

    # Total chunks
    total = await db.quiz_chunks.count_documents({"document_id": doc_oid})

    # Exhausted (over max usage)
    exhausted = await db.quiz_chunks.count_documents({
        "document_id": doc_oid,
        "usage_count": {"$gte": max_usage}
    })

    # Recently used (within decay window)
    recently_used = await db.quiz_chunks.count_documents({
        "document_id": doc_oid,
        "last_used_at": {"$gte": cutoff},
        "usage_count": {"$lt": max_usage}
    })

    # Available by section
    pipeline = [
        {
            "$match": {
                "document_id": doc_oid,
                "usage_count": {"$lt": max_usage},
                "$or": [
                    {"last_used_at": None},
                    {"last_used_at": {"$lt": cutoff}}
                ]
            }
        },
        {
            "$group": {
                "_id": "$section",
                "count": {"$sum": 1}
            }
        }
    ]
    section_counts = {}
    async for doc in db.quiz_chunks.aggregate(pipeline):
        section_counts[doc["_id"]] = doc["count"]

    available = total - exhausted - recently_used

    return {
        "total_chunks": total,
        "available_chunks": max(0, available),
        "exhausted_chunks": exhausted,
        "recently_used_chunks": recently_used,
        "sections": section_counts,
    }


async def get_usage_stats(
    db: AsyncIOMotorDatabase,
    document_id: str
) -> Dict:
    """
    Get comprehensive usage statistics for a document's chunks.

    Returns:
    {
        "total_chunks": int,
        "total_quizzes": int,
        "avg_usage_count": float,
        "max_usage_count": int,
        "chunks_never_used": int,
        "question_type_coverage": {"mcq": int, "tf": int, ...}
    }
    """
    doc_oid = ObjectId(document_id) if isinstance(document_id, str) else document_id

    # Basic stats
    pipeline = [
        {"$match": {"document_id": doc_oid}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "avg_usage": {"$avg": "$usage_count"},
            "max_usage": {"$max": "$usage_count"},
            "never_used": {"$sum": {"$cond": [{"$eq": ["$usage_count", 0]}, 1, 0]}},
        }}
    ]
    stats = await db.quiz_chunks.aggregate(pipeline).to_list(length=1)

    total_quizzes = await db.quizzes.count_documents({"document_id": doc_oid})

    # Question type coverage
    type_pipeline = [
        {"$match": {"document_id": doc_oid}},
        {"$unwind": "$question_types_generated"},
        {"$group": {
            "_id": "$question_types_generated",
            "count": {"$sum": 1}
        }}
    ]
    type_counts = {}
    async for doc in db.quiz_chunks.aggregate(type_pipeline):
        type_counts[doc["_id"]] = doc["count"]

    if stats:
        s = stats[0]
        return {
            "total_chunks": s.get("total", 0),
            "total_quizzes": total_quizzes,
            "avg_usage_count": round(s.get("avg_usage", 0), 2),
            "max_usage_count": s.get("max_usage", 0),
            "chunks_never_used": s.get("never_used", 0),
            "question_type_coverage": type_counts,
        }
    return {
        "total_chunks": 0,
        "total_quizzes": total_quizzes,
        "avg_usage_count": 0,
        "max_usage_count": 0,
        "chunks_never_used": 0,
        "question_type_coverage": {},
    }
