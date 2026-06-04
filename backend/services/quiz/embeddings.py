"""
Embedding Service.
Generates vector embeddings per chunk using Ollama nomic-embed-text.
Stores embeddings in quiz_chunks.embedding field.

Uses the same Ollama instance already configured for AI matching.

How to switch embedding model:
    - Change EMBEDDING_MODEL below or set QUIZ_EMBEDDING_MODEL env var
    - For OpenAI: set OPENAI_API_KEY env var, change generate_embedding() to use openai client
"""

import os
import logging
import asyncio
from typing import List, Dict, Optional
from datetime import datetime
from pathlib import Path

import httpx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
# Reuse the same Ollama setup from ai_matching service
EMBEDDING_MODEL = os.getenv("QUIZ_EMBEDDING_MODEL", "nomic-embed-text")
EMBEDDING_DIM = 768  # nomic-embed-text output dimension

# Batch settings
BATCH_SIZE = int(os.getenv("QUIZ_EMBEDDING_BATCH_SIZE", "20"))
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # seconds
EMBED_MAX_CONCURRENT = int(os.getenv("QUIZ_EMBED_MAX_CONCURRENT", "8"))


def _ollama_base_url() -> str:
    return os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/api")


# ── Embedding Generation ────────────────────────────────────────────────────

async def generate_embedding(
    text: str,
    client: Optional[httpx.AsyncClient] = None
) -> List[float]:
    """
    Generate a single embedding vector using Ollama nomic-embed-text.

    Args:
        text: Text to embed.
        client: Optional httpx client to reuse. Creates one if not provided.

    Returns:
        List of floats (768-dim vector).
    """
    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=60.0)

    try:
        for attempt in range(MAX_RETRIES):
            try:
                response = await client.post(
                    f"{_ollama_base_url()}/embed",
                    json={
                        "model": EMBEDDING_MODEL,
                        "input": text[:8000]  # Truncate very long texts
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                # Ollama /api/embed returns {"embeddings": [[float, ...]]}
                embedding = data.get("embeddings", [[]])[0]

                if not embedding:
                    logger.warning(f"Empty embedding returned for text: {text[:50]}...")
                    return []

                return embedding

            except (httpx.HTTPError, httpx.ConnectError) as e:
                if attempt < MAX_RETRIES - 1:
                    wait_time = RETRY_BACKOFF_BASE ** (attempt + 1)
                    logger.warning(f"Embedding attempt {attempt+1} failed: {e}. Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"Embedding failed after {MAX_RETRIES} attempts: {e}")
                    raise
    finally:
        if own_client:
            await client.aclose()


async def generate_embeddings_batch(
    texts: List[str],
    client: Optional[httpx.AsyncClient] = None
) -> List[List[float]]:
    """
    Generate embeddings for a batch of texts concurrently.
    Uses a semaphore to cap concurrent Ollama requests.
    """
    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=60.0)

    sem = asyncio.Semaphore(EMBED_MAX_CONCURRENT)

    async def _embed(text: str) -> List[float]:
        async with sem:
            return await generate_embedding(text, client)

    try:
        embeddings = list(await asyncio.gather(*[_embed(t) for t in texts]))
    finally:
        if own_client:
            await client.aclose()

    return embeddings


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
    client = httpx.AsyncClient(timeout=60.0)
    embedded_count = 0

    try:
        for batch_start in range(0, len(texts), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(texts))
            batch_texts = texts[batch_start:batch_end]
            batch_chunks = chunk_docs[batch_start:batch_end]

            logger.info(f"Embedding batch {batch_start//BATCH_SIZE + 1} "
                        f"({batch_start+1}-{batch_end}/{len(texts)})")

            batch_embeddings = await generate_embeddings_batch(batch_texts, client)

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
    finally:
        await client.aclose()

    return embedded_count
