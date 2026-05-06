"""
services/job_market_ai_service.py
----------------------------------
Singleton wrapper for the JobMarketAI inference engine (Modele-CNN).

The Modele-CNN repo is expected to sit at one of these locations (checked in order):
  1. $MODELE_CNN_PATH  (environment variable)
  2. ../Modele-CNN     (sibling directory — works when both repos share the same parent)

Usage
-----
from services.job_market_ai_service import get_ai_engine

ai = get_ai_engine()          # returns the singleton (lazy-loaded on first call)
result = ai.profile_recommendation(["python", "react", "docker"])
"""

from __future__ import annotations

import os
import sys
import threading
from pathlib import Path
from typing import Optional

# ── Path resolution ────────────────────────────────────────────────────────────

def _find_modele_cnn_root() -> Path:
    """
    Locate the Modele-CNN repository root.
    Checks env var MODELE_CNN_PATH first, then falls back to sibling directory.
    """
    env_path = os.getenv("MODELE_CNN_PATH")
    if env_path:
        p = Path(env_path).resolve()
        if p.exists():
            return p
        raise FileNotFoundError(
            f"MODELE_CNN_PATH is set to '{env_path}' but the directory does not exist."
        )

    # This file is at  backend/services/job_market_ai_service.py
    # The PFE repo root is  ../../
    # The sibling Modele-CNN is  ../../../Modele-CNN
    _HERE = Path(__file__).resolve()
    backend_dir = _HERE.parent.parent        # backend/
    pfe_root    = backend_dir.parent         # PFE-2026-yassine-youssef/
    workspace   = pfe_root.parent            # GitHub/ (common parent)

    sibling = workspace / "Modele-CNN"
    if sibling.exists():
        return sibling

    raise FileNotFoundError(
        "Cannot find the Modele-CNN repository. "
        "Either place it as a sibling directory next to the PFE repo, "
        "or set the MODELE_CNN_PATH environment variable."
    )


def _ensure_imports_available(modele_cnn_root: Path) -> None:
    """Add Modele-CNN/app to sys.path so we can import inference, architecture, etc."""
    app_dir = str(modele_cnn_root / "app")
    if app_dir not in sys.path:
        sys.path.insert(0, app_dir)


# ── Singleton ──────────────────────────────────────────────────────────────────

_lock:   threading.Lock        = threading.Lock()
_engine: Optional["JobMarketAI"] = None  # type: ignore[name-defined]
_load_error: Optional[Exception]  = None


def get_ai_engine():
    """
    Return the shared JobMarketAI singleton.
    Lazy-loads the model on the first call (thread-safe).

    Raises
    ------
    RuntimeError  if the model failed to load (message includes the root cause).
    """
    global _engine, _load_error

    if _engine is not None:
        return _engine

    if _load_error is not None:
        raise RuntimeError(f"JobMarketAI failed to load: {_load_error}") from _load_error

    with _lock:
        # Double-checked locking
        if _engine is not None:
            return _engine
        if _load_error is not None:
            raise RuntimeError(f"JobMarketAI failed to load: {_load_error}") from _load_error

        try:
            root = _find_modele_cnn_root()
            _ensure_imports_available(root)

            # Import here (after sys.path is set up)
            from models.inference import JobMarketAI  # type: ignore
            from models.config    import ModelConfig   # type: ignore

            model_assets = root / "model_assets"
            cfg = ModelConfig(
                processed_dir=model_assets,
                model_dir=model_assets,
            )
            _engine = JobMarketAI(cfg=cfg, device="auto")
            print(f"[JobMarketAI] Model loaded successfully from {model_assets}")
        except Exception as exc:
            _load_error = exc
            print(f"[JobMarketAI] ERROR loading model: {exc}")
            raise RuntimeError(f"JobMarketAI failed to load: {exc}") from exc

    return _engine


def is_engine_available() -> bool:
    """Return True if the model is loaded and ready (does NOT trigger loading)."""
    return _engine is not None


def get_engine_status() -> dict:
    """
    Return a status dict suitable for a health-check endpoint.
    Does NOT trigger loading.
    """
    if _engine is not None:
        return {
            "status": "ready",
            "n_skills": _engine.n_skills,
            "n_profiles": _engine.n_profiles,
            "device": str(_engine.device),
        }
    if _load_error is not None:
        return {"status": "error", "detail": str(_load_error)}
    return {"status": "not_loaded"}
