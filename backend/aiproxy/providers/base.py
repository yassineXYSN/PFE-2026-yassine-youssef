"""Typed provider protocols for the aiproxy dispatch layer.

Each provider module (``ollama``, `huggingface``, ``openai``, ``cohere``,
``mock``) implements one or more of these protocols. The router dispatches
by provider name using these as the expected call shape; nothing here is
imported at runtime for behavior, only for typing/documentation purposes.
"""

from typing import Protocol


class EmbeddingProvider(Protocol):
    async def embed(
        self,
        texts: list[str],
        *,
        input_type: str,
        model: str,
    ) -> list[list[float]]:
        ...


class ChatProvider(Protocol):
    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str,
        json_mode: bool,
        temperature: float,
        max_tokens: int | None,
    ) -> str:
        ...


class RerankProvider(Protocol):
    async def rerank(
        self,
        query: str,
        documents: list[str],
        *,
        model: str,
        top_n: int | None,
    ) -> list[dict]:
        ...


class TranscriptionProvider(Protocol):
    async def transcribe(
        self,
        audio: bytes,
        *,
        model: str,
        language: str | None,
    ) -> str:
        ...
