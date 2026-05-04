import threading
import os
import warnings

import torch
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification, pipeline as hf_pipeline

os.environ.setdefault("DISABLE_SAFETENSORS_CONVERSION", "1")

_pipeline = None
_pipeline_lock = threading.Lock()
MODEL_NAME = "superb/wav2vec2-base-superb-er"


def _select_device() -> int:
    try:
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message=".*not compatible with the current PyTorch installation.*")
            cuda_available = torch.cuda.is_available()
        if cuda_available:
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message=".*not compatible with the current PyTorch installation.*")
                major, minor = torch.cuda.get_device_capability(0)
            capability = f"sm_{major}{minor}"
            supported_arches = set(torch.cuda.get_arch_list())
            if supported_arches and capability not in supported_arches:
                print(
                    f"[interview-ai] CUDA device capability {capability} is not supported "
                    "by this PyTorch build; using CPU for wav2vec2."
                )
                return -1
            return 0
    except Exception:
        pass
    return -1


def get_audio_pipeline() -> tuple:
    global _pipeline
    if _pipeline is None:
        device = _select_device()
        print(f"[interview-ai] Loading wav2vec2 audio emotion model on {'GPU' if device == 0 else 'CPU'}")
        feature_extractor = AutoFeatureExtractor.from_pretrained(
            MODEL_NAME,
            local_files_only=True,
        )
        model = AutoModelForAudioClassification.from_pretrained(
            MODEL_NAME,
            local_files_only=True,
            use_safetensors=False,
        )
        _pipeline = hf_pipeline(
            "audio-classification",
            model=model,
            feature_extractor=feature_extractor,
            device=device,
        )
    return _pipeline, _pipeline_lock

