import threading

import torch
from transformers import pipeline as hf_pipeline

_pipeline = None
_pipeline_lock = threading.Lock()


def _select_device() -> int:
    try:
        if torch.cuda.is_available():
            return 0
    except Exception:
        pass
    return -1


def get_audio_pipeline() -> tuple:
    global _pipeline
    if _pipeline is None:
        device = _select_device()
        print(f"[interview-ai] Loading wav2vec2 audio emotion model on {'GPU' if device == 0 else 'CPU'}")
        _pipeline = hf_pipeline(
            "audio-classification",
            model="superb/wav2vec2-base-superb-er",
            device=device,
        )
    return _pipeline, _pipeline_lock

