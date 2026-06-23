"""
app/models/config.py  — Runtime inference configuration
All paths resolve relative to this file so the app works regardless
of where it is launched from.
"""

from dataclasses import dataclass, field
from pathlib import Path

# model_assets/ sits one level above app/
_HERE           = Path(__file__).resolve().parent          # app/models/
_APP_DIR        = _HERE.parent                             # app/
_MODEL_ASSETS   = _APP_DIR.parent / "model_assets"        # JobMarketAI/model_assets/


@dataclass
class ModelConfig:
    # ── Paths ──────────────────────────────────────────────────────────────
    # vocab (skill_vocab.json, profile_vocab.json) lives in model_assets/
    processed_dir: Path = _MODEL_ASSETS
    # trained weights (profile_classifier.pt, skill_vae.pt) live in model_assets/
    model_dir:     Path = _MODEL_ASSETS

    # ── Model dimensions  (must match the trained checkpoint) ──────────────
    embed_dim:  int   = 128
    hidden_dim: int   = 512
    latent_dim: int   = 64
    n_heads:    int   = 4
    dropout:    float = 0.3

    # ── Inference knobs ───────────────────────────────────────────────────
    max_skills_per_cv: int = 40
    topk_profiles:     int = 3
    topk_liaison:      int = 10
    topk_upskilling:   int = 8

    def __post_init__(self):
        for attr in ("processed_dir", "model_dir"):
            val = getattr(self, attr)
            if isinstance(val, str):
                setattr(self, attr, Path(val))
