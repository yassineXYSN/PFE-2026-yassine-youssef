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


# Hallucinations Whisper commonly emits on pure-silence / music / noise chunks.
# Substring match — covers conjugations and partial bleeds.
_HALLUCINATION_SUBSTRINGS = (
    "sous-titres réalisés par la communauté amara",
    "sous-titrage st' 501",
    "sous-titrage société radio-canada",
    "merci d'avoir regardé",
    "thanks for watching",
    "thank you for watching",
    "abonnez-vous",
    "like and subscribe",
    "♪",
)

# Only patterns that are NEVER real speech — not short words people actually say.
# "oui", "non", "merci", "ok" were removed: they are valid interview responses.
_TRIVIAL_SHORT = {
    "...", ".", "..", "—", "…",
}


_PUNCT_STRIP = ".,;:!?\"'()[]{}«»…"


def _normalize_words(text: str) -> list:
    return [w.strip(_PUNCT_STRIP) for w in text.lower().split() if w.strip(_PUNCT_STRIP)]


def _has_repetition_loop(text: str) -> bool:
    """Detect Whisper's classic 'I am running, I am running, I am running' loop.

    Heuristics:
      1. A phrase of 1–5 words repeats >= 3 times anywhere in the output.
      2. Unique-word ratio < 0.4 on utterances of >= 6 words.
    """
    words = _normalize_words(text)
    n = len(words)
    if n < 4:
        return False

    # Heuristic 1 — sliding-window phrase repetition (punctuation-insensitive)
    for size in (1, 2, 3, 4, 5):
        if n < size * 3:
            continue
        for i in range(n - size * 3 + 1):
            phrase = words[i : i + size]
            if (
                words[i + size : i + size * 2] == phrase
                and words[i + size * 2 : i + size * 3] == phrase
            ):
                return True

    # Heuristic 2 — vocabulary collapse on longer output
    if n >= 6:
        uniq = len(set(words))
        if uniq / n < 0.4:
            return True

    return False


def _is_hallucination(text: str) -> bool:
    t = text.strip().lower()
    if not t:
        return True
    stripped = t.strip(_PUNCT_STRIP).strip()
    if not stripped:
        return True
    if stripped in _TRIVIAL_SHORT or stripped.rstrip(".!?,") in _TRIVIAL_SHORT:
        return True
    for needle in _HALLUCINATION_SUBSTRINGS:
        if needle in t:
            return True
    if _has_repetition_loop(t):
        return True
    return False


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
        self.model_size = model_size or os.getenv("WHISPER_MODEL", "large-v3-turbo")

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
                vad_parameters=dict(min_silence_duration_ms=400),
                beam_size=1,
                condition_on_previous_text=False,
                no_speech_threshold=0.45,
                temperature=[0.0, 0.2, 0.4],
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
            )
            detected_lang = getattr(info, "language", language or "?")
            lang_prob = getattr(info, "language_probability", 0.0)
            print(f"[Whisper] lang={detected_lang} ({lang_prob:.2f})")

            kept = []
            for s in segments:
                prob = getattr(s, "no_speech_prob", 0.0)
                if prob > 0.45:
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

        if _is_hallucination(text):
            print(f"[Whisper] dropped hallucination: {text!r}")
            return ""
        return text


_service: Optional[WhisperService] = None


def get_whisper_service() -> WhisperService:
    global _service
    if _service is None:
        _service = WhisperService()
    return _service
