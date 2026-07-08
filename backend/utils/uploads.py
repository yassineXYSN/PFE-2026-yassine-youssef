import os
from typing import Optional
from fastapi import HTTPException

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
DOC_EXTS = {".pdf", ".doc", ".docx"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_DOC_BYTES = 15 * 1024 * 1024


def validate_upload(
    filename: str,
    data: bytes,
    *,
    allowed_exts: set,
    max_bytes: int,
    allowed_content_types: Optional[set] = None,
    content_type: Optional[str] = None,
) -> str:
    """Validate an uploaded file. Returns the safe lowercased extension.

    Raises HTTPException 400 (bad type) or 413 (too large).
    """
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large")
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext or 'none'}")
    if allowed_content_types and content_type and content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail=f"Content-type not allowed: {content_type}")
    return ext
