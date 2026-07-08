"""Deterministic mock provider.

- ``embed``: returns vectors of the configured dimension, seeded from a
  stable hash of each input text (not Python's randomized ``hash()``), so
  ``FAKE_ANALYSIS`` runs never write wrong-dimension vectors and repeated
  calls with the same text are reproducible across process runs.
- ``chat``: intentionally NOT implemented here. Preserving today's contract,
  chat mock mode is handled by callers / ``dispatch_chat`` raises
  ``ValueError`` when provider == "mock" (see ``aiproxy.router``).
- ``rerank``: returns documents in original order with descending synthetic
  relevance scores (identity ordering).
- ``transcribe``: returns a fixed canned transcript string.
"""

import hashlib
import random


def _stable_seed(text: str) -> int:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


class MockProvider:
    async def embed(
        self,
        texts: list[str],
        *,
        input_type: str = "search_document",
        model: str = "mock",
        dim: int = 1024,
    ) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            rng = random.Random(_stable_seed(text))
            vectors.append([rng.uniform(0.0, 1.0) for _ in range(dim)])
        return vectors

    async def rerank(
        self,
        query: str,
        documents: list[str],
        *,
        model: str = "mock",
        top_n: int | None = None,
    ) -> list[dict]:
        n = len(documents)
        results = [
            {"index": i, "relevance_score": (n - i) / n if n else 0.0}
            for i in range(n)
        ]
        if top_n is not None:
            results = results[:top_n]
        return results

    async def transcribe(
        self,
        audio: bytes,
        *,
        model: str = "mock",
        language: str | None = None,
    ) -> str:
        return "[MOCK] transcription de test."
