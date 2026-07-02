"""
Embedding Service.
Generates vector embeddings per chunk via the aiproxy embedding gateway.
Stores embeddings in quiz_chunks.embedding field.

Routes through aiproxy.embed(), which resolves the active embedding
provider/model (Cohere by default) from config.

How to switch embedding model:
    - Set EMBEDDING_PROVIDER / COHERE_EMBED_MODEL (or the Ollama fallback
      envs, e.g. QUIZ_EMBEDDING_MODEL) — see backend/aiproxy/config.py.
    - No code changes needed here; this module only calls aiproxy.embed().
"""

import os
import logging
from typing import Any, List, Dict, Optional
from pathlib import Path

import aiproxy
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
# Batch settings
BATCH_SIZE = int(os.getenv("QUIZ_EMBEDDING_BATCH_SIZE", "20"))


# ── Embedding Generation ────────────────────────────────────────────────────

async def generate_embedding(
    text: str,
    client: Optional[Any] = None
) -> List[float]:
    """
    Generate a single document embedding vector via aiproxy.

    Args:
        text: Text to embed.
        client: Unused; kept for backward compatibility with callers that
            used to pass an httpx client (aiproxy owns its own HTTP layer now).

    Returns:
        List of floats (embedding vector, dimension depends on active provider).
    """
    embedding = await aiproxy.embed(text[:8000], input_type="search_document")

    if not embedding:
        logger.warning(f"Empty embedding returned for text: {text[:50]}...")
        return []

    return embedding


async def generate_embeddings_batch(
    texts: List[str],
    client: Optional[Any] = None
) -> List[List[float]]:
    """
    Generate document embeddings for a batch of texts via aiproxy.
    aiproxy handles provider batching internally (e.g. chunks of 96 for Cohere).

    Args:
        texts: Texts to embed.
        client: Unused; kept for backward compatibility.
    """
    if not texts:
        return []

    truncated = [t[:8000] for t in texts]
    return await aiproxy.embed(truncated, input_type="search_document")


# ── Store Embeddings in MongoDB ──────────────────────────────────────────────

async def embed_and_store_chunks(
    db: AsyncIOMotorDatabase,
    document_id: str,
    chunk_docs: Optional[List[Dict]] = None
) -> int:
    """
    Generate embeddings for all chunks of a document and store them.

    Args:
        db: Async MongoDB database instance.
        document_id: The quiz_documents._id reference.
        chunk_docs: Optional pre-fetched chunks. If None, fetches from DB.

    Returns:
        Number of chunks successfully embedded.
    """
    doc_oid = ObjectId(document_id) if isinstance(document_id, str) else document_id

    # Fetch chunks if not provided
    if chunk_docs is None:
        chunk_docs = await db.quiz_chunks.find(
            {"document_id": doc_oid, "embedding": None}
        ).to_list(length=None)

    if not chunk_docs:
        logger.warning(f"No chunks found to embed for document {document_id}")
        return 0

    # Extract texts
    texts = [c["text"] for c in chunk_docs]

    # Generate embeddings in batches
    embedded_count = 0

    try:
        for batch_start in range(0, len(texts), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(texts))
            batch_texts = texts[batch_start:batch_end]
            batch_chunks = chunk_docs[batch_start:batch_end]

            logger.info(f"Embedding batch {batch_start//BATCH_SIZE + 1} "
                        f"({batch_start+1}-{batch_end}/{len(texts)})")

            batch_embeddings = await generate_embeddings_batch(batch_texts)

            # Store each embedding
            for chunk, embedding in zip(batch_chunks, batch_embeddings):
                if embedding:
                    await db.quiz_chunks.update_one(
                        {"_id": chunk["_id"]},
                        {"$set": {"embedding": embedding}}
                    )
                    embedded_count += 1

        # Update document status to ready
        await db.quiz_documents.update_one(
            {"_id": doc_oid},
            {"$set": {"status": "ready"}}
        )

        logger.info(f"Successfully embedded {embedded_count}/{len(texts)} chunks for document {document_id}")

    except Exception as e:
        logger.error(f"Embedding pipeline failed for document {document_id}: {e}")
        # Mark document as error
        await db.quiz_documents.update_one(
            {"_id": doc_oid},
            {"$set": {"status": "error"}}
        )
        raise

    return embedded_count
