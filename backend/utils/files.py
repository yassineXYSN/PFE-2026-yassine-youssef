import os
import shutil
from fastapi import UploadFile
from typing import Optional, Tuple

# Base directory for resolving file_path values stored in MongoDB
# This assumes the utility is in backend/utils/
_UTILS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.abspath(os.path.join(_UTILS_DIR, ".."))
_UPLOAD_DIR = os.path.join(_BACKEND_ROOT, "static", "uploads")

def resolve_file(file_info: dict) -> Optional[Tuple[str, str, str]]:
    """
    Return (abs_path, content_type, filename) from a file_info dict.

    Supports two storage modes:
    - **disk**: file_info has ``file_path`` relative to backend root.
    - **legacy**: file_info has ``file_data`` bytes stored in MongoDB (handled by caller if this returns None).

    Returns ``None`` when the file_info contains neither or if the file on disk is missing.
    """
    if not file_info:
        return None

    # New disk-based storage
    if file_info.get("file_path"):
        # Ensure path uses OS-appropriate separators
        rel_path = file_info["file_path"].replace("/", os.sep).replace("\\", os.sep)
        abs_path = os.path.join(_BACKEND_ROOT, rel_path)
        
        if os.path.isfile(abs_path):
            return (
                abs_path, 
                file_info.get("content_type", "application/octet-stream"), 
                file_info.get("filename", "file")
            )

    return None

def get_upload_dir() -> str:
    """Returns the absolute path to the static uploads directory."""
    os.makedirs(_UPLOAD_DIR, exist_ok=True)
    return _UPLOAD_DIR

def get_backend_root() -> str:
    """Returns the absolute path to the backend root directory."""
    return _BACKEND_ROOT
