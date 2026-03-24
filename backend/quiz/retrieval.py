"""
Vector Retrieval Engine.
Implements top-k nearest-neighbor retrieval using Atlas $vectorSearch
with automatic cosine similarity fallback for non-Atlas environments.

Supports metadata filters: usage_count threshold, decay window, section filter.
"""

import os
import logging
import numpy as np
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from quiz.embeddings import generate_embedding

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
# If True, use Atlas $vectorSearch. If False, use cosine fallback.
USE_ATLAS_VECTOR_SEARCH = os.getenv("USE_ATLAS_VECTOR_SEARCH", "true").lower() == "true"
VECTOR_INDEX_NAME = os.getenv("QUIZ_VECTOR_INDEX_NAME", "quiz_chunks_vector_index")


# ── Atlas Vector Search ──────────────────────────────────────────────────────

async def atlas_vector_search(
    db: AsyncIOMotorDatabase,
    query_embedding: List[float],
    document_id: str,
    limit: int = 5,
    section_filter: Optional[List[str]] = None,
    max_usage_count: Optional[int] = None,
    decay_days: Optional[int] = None
) -> List[Dict]:
    """
    Top-k retrieval using Atlas $vectorSearch.

    Args:
        db: Async MongoDB database.
        query_embedding: Query vector (768-dim).
        document_id: Restrict search to chunks from this document.
        limit: Number of results to return.
        section_filter: Only include chunks from these sections.
        max_usage_count: Exclude chunks used more than this many times.
        decay_days: Exclude chunks used within this many days.

    Returns:
        List of chunk dicts with similarity score.
    """
    doc_oid = ObjectId(document_id) if isinstance(document_id, str) else document_id

    # Build filter
    vector_filter = {"document_id": doc_oid}
    if section_filter:
        vector_filter["section"] = {"$in": section_filter}
    if max_usage_count is not None:
        vector_filter["usage_count"] = {"$lt": max_usage_count}

    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": limit * 10,
                "limit": limit * 2,  # Fetch extra for post-filtering
                "filter": vector_filter
            }
        },
        {
            "$project": {
                "embedding": 0,
                "score": {"$meta": "vectorSearchScore"}
            }
        }
    ]

    try:
        cursor = db.quiz_chunks.aggregate(pipeline)
        results = await cursor.to_list(length=limit * 2)

        # Post-filter: decay window
        if decay_days is not None:
            cutoff = datetime.utcnow() - timedelta(days=decay_days)
            results = [
                r for r in results
                if r.get("last_used_at") is None or r["last_used_at"] < cutoff
            ]

        return results[:limit]

    except Exception as e:
        logger.warning(f"Atlas Vector Search failed: {e}. Falling back to cosine similarity.")
        return await cosine_similarity_search(
            db, query_embedding, document_id, limit,
            section_filter, max_usage_count, decay_days
        )


# ── Cosine Similarity Fallback ───────────────────────────────────────────────

def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


async def cosine_similarity_search(
    db: AsyncIOMotorDatabase,
    query_embedding: List[float],
    document_id: str,
    limit: int = 5,
    section_filter: Optional[List[str]] = None,
    max_usage_count: Optional[int] = None,
    decay_days: Optional[int] = None
) -> List[Dict]:
    """
    Brute-force cosine similarity search. Used when Atlas Vector Search is unavailable.
    Loads all chunks for the document, computes similarity, and returns top-k.

    Performance note: This is O(n) per query where n = number of chunks.
    Fine for documents with <1000 chunks. For larger scale, use Atlas Vector Search.
    """
    doc_oid = ObjectId(document_id) if isinstance(document_id, str) else document_id

    # Build MongoDB filter
    mongo_filter: Dict[str, Any] = {
        "document_id": doc_oid,
        "embedding": {"$ne": None}
    }
    if section_filter:
        mongo_filter["section"] = {"$in": section_filter}
    if max_usage_count is not None:
        mongo_filter["usage_count"] = {"$lt": max_usage_count}

    chunks = await db.quiz_chunks.find(mongo_filter).to_list(length=None)

    if not chunks:
        logger.warning(f"No embedded chunks found for document {document_id}")
        return []

    # Apply decay window filter
    if decay_days is not None:
        cutoff = datetime.utcnow() - timedelta(days=decay_days)
        chunks = [
            c for c in chunks
            if c.get("last_used_at") is None or c["last_used_at"] < cutoff
        ]

    # Compute similarities
    scored = []
    for chunk in chunks:
        emb = chunk.get("embedding")
        if emb:
            score = _cosine_similarity(query_embedding, emb)
            chunk_copy = {k: v for k, v in chunk.items() if k != "embedding"}
            chunk_copy["score"] = score
            scored.append(chunk_copy)

    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)

    return scored[:limit]


# ── Unified Retrieval Interface ──────────────────────────────────────────────

async def retrieve_chunks(
    db: AsyncIOMotorDatabase,
    query_text: str,
    document_id: str,
    limit: int = 5,
    section_filter: Optional[List[str]] = None,
    max_usage_count: Optional[int] = None,
    decay_days: Optional[int] = 30
) -> List[Dict]:
    """
    High-level retrieval function. Generates query embedding, then performs
    vector search with metadata filters.

    Args:
        db: Async MongoDB database.
        query_text: Natural language query to find relevant chunks.
        document_id: Restrict to chunks from this document.
        limit: Number of chunks to return.
        section_filter: Only include chunks from these sections.
        max_usage_count: Exclude over-used chunks.
        decay_days: Exclude recently-used chunks (within N days).

    Returns:
        List of chunk dicts with similarity score, ordered by relevance.

    Example:
        >>> chunks = await retrieve_chunks(db, "safety equipment requirements", doc_id, limit=5)
        >>> for c in chunks:
        ...     print(f"Score: {c['score']:.3f} | Section: {c['section']} | {c['text'][:80]}...")
    """
    # Generate query embedding
    query_embedding = await generate_embedding(query_text)
    if not query_embedding:
        logger.error("Failed to generate query embedding")
        return []

    # Choose search method
    if USE_ATLAS_VECTOR_SEARCH:
        results = await atlas_vector_search(
            db, query_embedding, document_id, limit,
            section_filter, max_usage_count, decay_days
        )
    else:
        results = await cosine_similarity_search(
            db, query_embedding, document_id, limit,
            section_filter, max_usage_count, decay_days
        )

    logger.info(f"Retrieved {len(results)} chunks for query: '{query_text[:50]}...'")
    return results


async def retrieve_chunks_for_quiz(
    db: AsyncIOMotorDatabase,
    document_id: str,
    total_questions: int = 10,
    section_filter: Optional[List[str]] = None,
    max_chunk_reuse: int = 3,
    decay_days: int = 30
) -> List[Dict]:
    """
    Retrieve diverse chunks suitable for quiz generation.
    Fetches more chunks than needed and selects for diversity.

    Uses the document's own content as query (self-retrieval) to get
    the most representative chunks, then applies diversity heuristics.

    Args:
        document_id: Document to generate quiz from.
        total_questions: Target number of questions (determines chunk count).
        section_filter: Optional section restriction.
        max_chunk_reuse: Max times a chunk can be reused.
        decay_days: Decay window for recently used chunks.

    Returns:
        List of diverse, relevant chunks.
    """
    doc_oid = ObjectId(document_id) if isinstance(document_id, str) else document_id

    # Build filter
    mongo_filter: Dict[str, Any] = {
        "document_id": doc_oid,
        "embedding": {"$ne": None},
    }
    if section_filter:
        mongo_filter["section"] = {"$in": section_filter}
    if max_chunk_reuse:
        mongo_filter["usage_count"] = {"$lt": max_chunk_reuse}

    # Apply decay window
    if decay_days:
        cutoff = datetime.utcnow() - timedelta(days=decay_days)
        mongo_filter["$or"] = [
            {"last_used_at": None},
            {"last_used_at": {"$lt": cutoff}}
        ]

    # Fetch available chunks, sorted by usage_count (prefer least-used)
    chunks = await db.quiz_chunks.find(
        mongo_filter,
        {"embedding": 0}  # Don't fetch large embedding vectors
    ).sort("usage_count", 1).to_list(length=None)

    if not chunks:
        # Fallback: fetch ALL chunks ignoring filters
        logger.warning(f"No chunks matched filters for document {document_id}. Falling back to all chunks.")
        chunks = await db.quiz_chunks.find(
            {"document_id": doc_oid},
            {"embedding": 0}
        ).to_list(length=None)

    # Select diverse chunks:
    # - Need roughly 1.5x chunks per question for variety
    # - Try to cover all sections
    target_chunks = min(len(chunks), int(total_questions * 1.5))

    # Group by section for balanced selection
    by_section: Dict[str, List[Dict]] = {}
    for chunk in chunks:
        section = chunk.get("section", "Main Content")
        by_section.setdefault(section, []).append(chunk)

    selected = []
    if section_filter:
        # If specific sections requested, just take from those
        for section in section_filter:
            section_chunks = by_section.get(section, [])
            per_section = max(1, target_chunks // len(section_filter))
            selected.extend(section_chunks[:per_section])
    else:
        # Round-robin across sections for diversity
        section_lists = list(by_section.values())
        idx = 0
        while len(selected) < target_chunks and section_lists:
            for section_chunks in section_lists:
                if idx < len(section_chunks) and len(selected) < target_chunks:
                    selected.append(section_chunks[idx])
            idx += 1
            # Remove exhausted sections
            section_lists = [s for s in section_lists if idx < len(s)]

    # If we still don't have enough, fill with remaining chunks
    if len(selected) < target_chunks:
        used_ids = {str(c["_id"]) for c in selected}
        for chunk in chunks:
            if str(chunk["_id"]) not in used_ids and len(selected) < target_chunks:
                selected.append(chunk)

    logger.info(f"Selected {len(selected)} diverse chunks for quiz generation "
                f"(target: {target_chunks}, available: {len(chunks)})")
    return selected
