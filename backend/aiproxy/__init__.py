"""aiproxy — provider-agnostic AI gateway.

The only surface application code should use. Capability functions
(``embed``, ``chat``, ``rerank``, ``transcribe``) resolve configuration for
the requested capability and dispatch to the configured provider. Swapping
a provider is a config change plus one new provider file — never a
scattered code change.

See ``docs/superpowers/specs/2026-07-02-aiproxy-design.md`` for the full
design rationale.
"""

import asyncio

from aiproxy import config
from aiproxy.errors import AIProxyError, ConfigError, ProviderError
from aiproxy.router import (
    dispatch_chat,
    dispatch_embed,
    dispatch_rerank,
    dispatch_transcribe,
    mock_provider,
)
from aiproxy.sttclean import is_hallucination

__all__ = [
    "embed",
    "embed_sync",
    "chat",
    "chat_sync",
    "rerank",
    "transcribe",
    "AIProxyError",
    "ConfigError",
    "ProviderError",
]


def _is_mock_embedding_provider() -> bool:
    return config.fake_analysis_enabled() or config.get_embedding_config().provider == "mock"


async def embed(
    texts,
    *,
    input_type: str = "search_document",
    capability: str = "embedding",
):
    """Generate embedding vector(s) for ``texts``.

    ``texts`` may be a single string (returns a single vector) or a list of
    strings (returns a list of vectors). ``input_type`` follows Cohere's
    convention: ``"search_document"`` for indexed content, ``"search_query"``
    for the query side of a similarity search.

    When ``FAKE_ANALYSIS`` is enabled, or the resolved embedding provider is
    ``"mock"``, returns deterministic mock vectors of the correct dimension
    for the active embedding config — callers never need their own fake-mode
    branch.
    """
    is_single = isinstance(texts, str)
    text_list = [texts] if is_single else list(texts)

    embedding_config = config.get_embedding_config()

    if _is_mock_embedding_provider():
        vectors = await mock_provider.embed(
            text_list,
            input_type=input_type,
            model=embedding_config.model,
            dim=embedding_config.dim,
        )
    else:
        vectors = await dispatch_embed(
            embedding_config.provider,
            embedding_config.model,
            text_list,
            input_type,
            capability=capability,
            dim=embedding_config.dim,
        )

    return vectors[0] if is_single else vectors


async def chat(
    messages: list[dict[str, str]],
    *,
    capability: str,
    json_mode: bool = False,
    temperature: float = 0.0,
    max_tokens: int | None = None,
) -> str:
    """Generate a chat completion for ``capability``.

    Resolves ``LLMSettings`` for the capability (same resolution as the
    legacy ``utils/ai_settings.py`` resolvers) and dispatches to the
    configured provider. Raises ``ValueError`` if the resolved provider is
    ``"mock"`` (callers are expected to branch on ``FAKE_ANALYSIS``/mock
    themselves for chat, preserving the historical contract).
    """
    settings = config.get_llm_settings(capability)
    return await dispatch_chat(
        settings.provider,
        settings.model,
        messages,
        json_mode=json_mode,
        temperature=temperature,
        max_tokens=max_tokens,
        capability=capability,
    )


async def rerank(
    query: str,
    documents: list[str],
    *,
    top_n: int | None = None,
    capability: str = "rerank",
) -> list[dict]:
    """Rerank ``documents`` against ``query``.

    Returns a list of ``{"index": int, "relevance_score": float}`` sorted
    descending by relevance.
    """
    rerank_config = config.get_rerank_config()
    return await dispatch_rerank(
        rerank_config.provider,
        rerank_config.model,
        query,
        documents,
        top_n,
        capability=capability,
    )


async def transcribe(
    audio: bytes,
    *,
    language: str | None = None,
    capability: str = "transcription",
) -> str:
    """Transcribe a short audio clip (WAV bytes) to text.

    Provider/model resolve from ``TRANSCRIPTION_PROVIDER`` & friends (see
    ``config.get_transcription_config``). Whisper-style hallucinations are
    filtered centrally for every provider — hallucinated output returns ``""``.

    Unlike embeddings, transcription ignores ``FAKE_ANALYSIS`` (live
    transcripts keep working in fake-analysis demos); use
    ``TRANSCRIPTION_PROVIDER=mock`` for a fully canned transcript.
    """
    cfg = config.get_transcription_config()
    text = await dispatch_transcribe(
        cfg.provider,
        cfg.model,
        audio,
        language=language,
        api_key=cfg.api_key,
        base_url=cfg.base_url,
        capability=capability,
    )
    if not text:
        return ""
    if is_hallucination(text):
        return ""
    return text


def _run_sync(coro):
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    else:
        coro.close()
        raise AIProxyError(
            "aiproxy: *_sync variants cannot be called from a running event loop; "
            "use the async variant (embed/chat/rerank) instead."
        )


def embed_sync(
    texts,
    *,
    input_type: str = "search_document",
    capability: str = "embedding",
):
    """Synchronous wrapper around :func:`embed`.

    Safe only when called from a thread with no running event loop (e.g. a
    Starlette sync endpoint executed in the threadpool). Raises
    ``AIProxyError`` if called from within a running event loop.
    """
    return _run_sync(embed(texts, input_type=input_type, capability=capability))


def chat_sync(
    messages: list[dict[str, str]],
    *,
    capability: str,
    json_mode: bool = False,
    temperature: float = 0.0,
    max_tokens: int | None = None,
) -> str:
    """Synchronous wrapper around :func:`chat`.

    Safe only when called from a thread with no running event loop. Raises
    ``AIProxyError`` if called from within a running event loop.
    """
    return _run_sync(
        chat(
            messages,
            capability=capability,
            json_mode=json_mode,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    )
