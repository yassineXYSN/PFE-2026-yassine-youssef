import asyncio
from typing import Any

import numpy as np
from scipy.signal import resample

from .model import get_audio_pipeline

TARGET_SAMPLE_RATE = 16_000


def build_error_audio_payload(chunk_id: int | None, message: str) -> dict[str, Any]:
    return {"chunk_id": chunk_id, "status": "error", "error": message}


class AudioAnalyzer:
    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop
        self.queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=4)
        self._pipeline, self._lock = get_audio_pipeline()

    def _push_payload(self, payload: dict[str, Any]) -> None:
        if self.queue.full():
            try:
                self.queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        self.queue.put_nowait(payload)

    def _run_inference(self, chunk_id: int, pcm: np.ndarray, sample_rate: int) -> None:
        try:
            if sample_rate != TARGET_SAMPLE_RATE:
                num_samples = int(len(pcm) * TARGET_SAMPLE_RATE / sample_rate)
                pcm = resample(pcm, num_samples).astype(np.float32)

            with self._lock:
                results = self._pipeline(pcm, sampling_rate=TARGET_SAMPLE_RATE)

            scores = {r["label"]: round(float(r["score"]), 4) for r in results}
            top = max(results, key=lambda r: r["score"])
            payload = {
                "chunk_id": chunk_id,
                "status": "ok",
                "emotion": top["label"],
                "scores": scores,
            }
        except Exception as exc:
            payload = build_error_audio_payload(chunk_id, f"Inference error: {exc}")

        self.loop.call_soon_threadsafe(self._push_payload, payload)

    def submit_chunk(self, chunk_id: int, pcm: np.ndarray, sample_rate: int) -> None:
        self.loop.run_in_executor(None, self._run_inference, chunk_id, pcm, sample_rate)

    async def get_payload(self) -> dict[str, Any]:
        return await self.queue.get()

    def close(self) -> None:
        pass

