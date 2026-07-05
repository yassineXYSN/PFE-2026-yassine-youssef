"""
Local faster-whisper transcription service.

Loaded once at FastAPI startup; serves all interview audio chunks from one
model instance. CUDA is auto-detected — falls back to CPU/int8 on dev boxes.
"""

from __future__ import annotations

import asyncio
import io
import os
import time
from typing import Optional

try:
    import torch
    _CUDA_AVAILABLE = bool(torch.cuda.is_available())
except Exception:
    _CUDA_AVAILABLE = False

from faster_whisper import WhisperModel

from aiproxy.sttclean import is_hallucination


class WhisperService:
    """Singleton wrapper around faster-whisper.

    Inference is serialized via an asyncio.Lock — one in-flight transcription
    at a time. With 2 speakers per call this is ample throughput and avoids
    GPU OOM / CPU thrash from concurrent runs on a single model instance.
    """

    def __init__(
        self,
        model_size: Optional[str] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
    ):
        self.model_size = model_size or os.getenv("WHISPER_MODEL", "base")

        if device is None:
            device = "cuda" if _CUDA_AVAILABLE else "cpu"
        self.device = device

        if compute_type is None:
            compute_type = "float16" if device == "cuda" else "int8"
        self.compute_type = compute_type

        self._model: Optional[WhisperModel] = None
        self._lock = asyncio.Lock()

    def load(self) -> None:
        """Eagerly load the model. Called from FastAPI lifespan startup.

        If GPU load fails (driver mismatch, OOM, unsupported compute capability),
        automatically falls back to CPU/int8 instead of leaving the server with
        no transcription.
        """
        if self._model is not None:
            return
        t0 = time.time()
        print(
            f"[Whisper] Loading '{self.model_size}' on {self.device} "
            f"(compute_type={self.compute_type})..."
        )
        try:
            self._model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
            )
        except Exception as gpu_exc:
            if self.device == "cuda":
                print(f"[Whisper] CUDA load failed ({gpu_exc}); falling back to CPU/int8")
                self.device = "cpu"
                self.compute_type = "int8"
                self._model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type,
                )
            else:
                raise
        print(f"[Whisper] Ready in {time.time() - t0:.1f}s")

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    async def transcribe(
        self,
        wav_bytes: bytes,
        language: Optional[str] = None,
    ) -> str:
        if self._model is None:
            self.load()

        async with self._lock:
            return await asyncio.to_thread(self._run, wav_bytes, language)

    def _run(self, wav_bytes: bytes, language: Optional[str]) -> str:
        assert self._model is not None
        try:
            segments, info = self._model.transcribe(
                io.BytesIO(wav_bytes),
                language=language,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
                beam_size=1,
                best_of=1,
                condition_on_previous_text=False,
                no_speech_threshold=0.35,  # Slightly stricter
                temperature=[0.0, 0.2, 0.4],
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
            )
            detected_lang = getattr(info, "language", language or "?")
            lang_prob = getattr(info, "language_probability", 0.0)
            
            # If the detected language is very uncertain and a default was provided, trust the default.
            if language and lang_prob < 0.6 and detected_lang != language:
                print(f"[Whisper] Uncertain lang={detected_lang} ({lang_prob:.2f}), forcing {language}")
                segments, info = self._model.transcribe(
                    io.BytesIO(wav_bytes),
                    language=language,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500),
                    beam_size=1,
                    best_of=1,
                )
            else:
                print(f"[Whisper] lang={detected_lang} ({lang_prob:.2f})")

            kept = []
            for s in segments:
                prob = getattr(s, "no_speech_prob", 0.0)
                if prob > 0.40:  # Slightly stricter
                    print(f"[Whisper] dropped segment (no_speech_prob={prob:.2f}): {s.text!r}")
                    continue
                txt = s.text.strip()
                if txt:
                    kept.append(txt)
            text = " ".join(kept).strip()


            # Top-level no-speech gate (info.all_language_probs may be unset on
            # some versions; guard with getattr).
            if not text:
                return ""
        except Exception as exc:
            print(f"[Whisper] transcribe failed: {exc}")
            return ""

        if is_hallucination(text):
            print(f"[Whisper] dropped hallucination: {text!r}")
            return ""
        return text


_service: Optional[WhisperService] = None


def get_whisper_service() -> WhisperService:
    global _service
    if _service is None:
        _service = WhisperService()
    return _service
