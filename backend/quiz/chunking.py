"""
Chunking Worker.
Splits extracted text into 200–500 token chunks with 10–20% overlap.
Stores chunk documents with metadata in MongoDB.

Uses tiktoken for accurate token counting (OpenAI-compatible).
Fallback: simple word-based estimation if tiktoken is unavailable.
"""

import logging
import re
from typing import List, Dict, Optional
from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# ── Token Counting ───────────────────────────────────────────────────────────

try:
    import tiktoken
    _encoder = tiktoken.get_encoding("cl100k_base")  # GPT-4 / modern encoding

    def count_tokens(text: str) -> int:
        """Count tokens using tiktoken (accurate)."""
        return len(_encoder.encode(text))

    def _tokenize(text: str) -> List[int]:
        return _encoder.encode(text)

    def _detokenize(tokens: List[int]) -> str:
        return _encoder.decode(tokens)

    TIKTOKEN_AVAILABLE = True
    logger.info("Using tiktoken for token counting.")
except ImportError:
    TIKTOKEN_AVAILABLE = False
    logger.warning("tiktoken not found. Using word-based estimation (less accurate). pip install tiktoken")

    def count_tokens(text: str) -> int:
        """Estimate tokens using word count (~1.3 tokens per word)."""
        return int(len(text.split()) * 1.3)

    def _tokenize(text: str) -> List[str]:
        return text.split()

    def _detokenize(tokens: List[str]) -> str:
        return " ".join(tokens)


# ── Chunking Logic ───────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    min_tokens: int = 200,
    max_tokens: int = 500,
    overlap_pct: float = 0.15,
    sections: Optional[List[Dict]] = None
) -> List[Dict]:
    """
    Split text into chunks with overlap.

    Args:
        text: The full extracted text to chunk.
        min_tokens: Minimum tokens per chunk (default 200).
        max_tokens: Maximum tokens per chunk (default 500).
        overlap_pct: Overlap percentage between chunks (default 15%).
        sections: Optional section metadata from ingestion.

    Returns:
        List of chunk dicts with keys: text, token_count, chunk_index, section.
    """
    if not text or not text.strip():
        return []

    # Determine overlap size in tokens
    overlap_tokens = int(max_tokens * overlap_pct)

    # Split into paragraphs first (natural boundaries)
    paragraphs = _split_into_paragraphs(text)

    chunks = []
    current_tokens = []
    current_section = _find_section("", 0, sections) if sections else "Main Content"
    char_offset = 0

    for para in paragraphs:
        para_tokens = _tokenize(para)
        para_token_count = len(para_tokens)

        # Check if this paragraph starts a new section
        if sections:
            new_section = _find_section(para, char_offset, sections)
            if new_section != current_section:
                # Flush current chunk before starting new section
                if current_tokens:
                    chunk_text_str = _detokenize(current_tokens)
                    chunks.append({
                        "text": chunk_text_str.strip(),
                        "token_count": len(current_tokens),
                        "chunk_index": len(chunks),
                        "section": current_section,
                    })
                    # Keep overlap from end of previous chunk
                    if overlap_tokens > 0 and len(current_tokens) > overlap_tokens:
                        current_tokens = current_tokens[-overlap_tokens:]
                    else:
                        current_tokens = []
                current_section = new_section

        # If adding this paragraph exceeds max_tokens, flush current chunk
        if len(current_tokens) + para_token_count > max_tokens and len(current_tokens) >= min_tokens:
            chunk_text_str = _detokenize(current_tokens)
            chunks.append({
                "text": chunk_text_str.strip(),
                "token_count": len(current_tokens),
                "chunk_index": len(chunks),
                "section": current_section,
            })
            # Keep overlap
            if overlap_tokens > 0 and len(current_tokens) > overlap_tokens:
                current_tokens = current_tokens[-overlap_tokens:]
            else:
                current_tokens = []

        # If single paragraph is larger than max_tokens, split it
        if para_token_count > max_tokens:
            sub_chunks = _split_large_paragraph(para_tokens, max_tokens, overlap_tokens)
            for sub in sub_chunks:
                combined = current_tokens + sub
                if len(combined) > max_tokens and len(current_tokens) >= min_tokens:
                    chunk_text_str = _detokenize(current_tokens)
                    chunks.append({
                        "text": chunk_text_str.strip(),
                        "token_count": len(current_tokens),
                        "chunk_index": len(chunks),
                        "section": current_section,
                    })
                    current_tokens = sub
                else:
                    current_tokens = combined
        else:
            current_tokens.extend(para_tokens)

        char_offset += len(para) + 2  # +2 for paragraph separator

    # Flush remaining tokens
    if current_tokens:
        chunk_text_str = _detokenize(current_tokens)
        if len(current_tokens) >= min_tokens // 2:  # Allow smaller final chunk
            chunks.append({
                "text": chunk_text_str.strip(),
                "token_count": len(current_tokens),
                "chunk_index": len(chunks),
                "section": current_section,
            })
        elif chunks:
            # Merge small remainder into last chunk
            last = chunks[-1]
            last["text"] = last["text"] + " " + chunk_text_str.strip()
            last["token_count"] = count_tokens(last["text"])

    # Re-index chunks
    for i, chunk in enumerate(chunks):
        chunk["chunk_index"] = i

    logger.info(f"Created {len(chunks)} chunks (min={min_tokens}, max={max_tokens}, overlap={overlap_pct*100:.0f}%)")
    return chunks


def _split_into_paragraphs(text: str) -> List[str]:
    """Split text into paragraphs on double-newlines or heading markers."""
    # Split on double newlines
    parts = re.split(r"\n\s*\n", text)
    paragraphs = [p.strip() for p in parts if p.strip()]
    return paragraphs


def _split_large_paragraph(tokens: list, max_tokens: int, overlap: int) -> List[list]:
    """Split a large token list into sub-chunks."""
    sub_chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + max_tokens, len(tokens))
        sub_chunks.append(tokens[start:end])
        start = end - overlap if overlap > 0 else end
        if start >= len(tokens):
            break
    return sub_chunks


def _find_section(paragraph: str, char_offset: int, sections: Optional[List[Dict]]) -> str:
    """Find which section a paragraph belongs to based on character offset."""
    if not sections:
        return "Main Content"

    # Check if paragraph text matches a section title
    stripped = paragraph.strip()
    for s in sections:
        if s.get("title", "").lower() in stripped.lower():
            return s["title"]

    # Find section by position (using start_pos from detect_sections)
    current_section = sections[0].get("title", "Main Content")
    for s in sections:
        if s.get("start_pos", 0) <= char_offset:
            current_section = s["title"]
        else:
            break
    return current_section


# ── Store Chunks in MongoDB ──────────────────────────────────────────────────

async def chunk_and_store(
    db: AsyncIOMotorDatabase,
    document_id: str,
    text: str,
    sections: Optional[List[Dict]] = None,
    min_tokens: int = 200,
    max_tokens: int = 500,
    overlap_pct: float = 0.15
) -> List[Dict]:
    """
    Chunk text and store all chunks in MongoDB quiz_chunks collection.

    Args:
        db: Async MongoDB database instance.
        document_id: The quiz_documents._id reference.
        text: Full extracted text.
        sections: Section metadata from ingestion.
        min_tokens: Minimum chunk size.
        max_tokens: Maximum chunk size.
        overlap_pct: Overlap percentage.

    Returns:
        List of stored chunk dicts with _id.
    """
    chunks = chunk_text(text, min_tokens, max_tokens, overlap_pct, sections)

    if not chunks:
        logger.warning(f"No chunks generated for document {document_id}")
        return []

    # Prepare MongoDB documents
    chunk_docs = []
    for chunk in chunks:
        chunk_doc = {
            "document_id": ObjectId(document_id) if isinstance(document_id, str) else document_id,
            "chunk_index": chunk["chunk_index"],
            "text": chunk["text"],
            "token_count": chunk["token_count"],
            "section": chunk["section"],
            "embedding": None,  # Will be filled by embedding worker
            "usage_count": 0,
            "last_used_at": None,
            "question_types_generated": [],
            "created_at": datetime.utcnow(),
        }
        chunk_docs.append(chunk_doc)

    # Bulk insert
    result = await db.quiz_chunks.insert_many(chunk_docs)
    logger.info(f"Stored {len(result.inserted_ids)} chunks for document {document_id}")

    # Update document with chunk count and total tokens
    total_tokens = sum(c["token_count"] for c in chunks)

    # Update section boundaries
    section_info = []
    current_section = None
    start_idx = 0
    for chunk in chunks:
        if chunk["section"] != current_section:
            if current_section is not None:
                section_info.append({
                    "title": current_section,
                    "start_chunk": start_idx,
                    "end_chunk": chunk["chunk_index"] - 1,
                })
            current_section = chunk["section"]
            start_idx = chunk["chunk_index"]
    if current_section:
        section_info.append({
            "title": current_section,
            "start_chunk": start_idx,
            "end_chunk": len(chunks) - 1,
        })

    await db.quiz_documents.update_one(
        {"_id": ObjectId(document_id) if isinstance(document_id, str) else document_id},
        {"$set": {
            "total_chunks": len(chunks),
            "total_tokens": total_tokens,
            "sections": section_info,
        }}
    )

    # Return chunks with their MongoDB _ids
    for i, chunk_doc in enumerate(chunk_docs):
        chunk_doc["_id"] = result.inserted_ids[i]

    return chunk_docs
