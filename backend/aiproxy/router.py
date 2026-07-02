"""Capability -> provider dispatch for the aiproxy package.

Holds the provider registries and the three ``dispatch_*`` functions used
by the public facade (``aiproxy/__init__.py``). Adding a new provider means
adding its class + one registry entry here — nothing else changes.
"""

import logging

from aiproxy import config
from aiproxy.providers.cohere import CohereProvider
from aiproxy.providers.huggingface import HuggingFaceProvider
from aiproxy.providers.mock import MockProvider
from aiproxy.providers.ollama import OllamaProvider
from aiproxy.providers.openai import OpenAIProvider

logger = logging.getLogger(__name__)

_cohere = CohereProvider()
_huggingface = HuggingFaceProvider()
_ollama = OllamaProvider()
_openai = OpenAIProvider()
_mock = MockProvider()

EMBEDDING_PROVIDERS = {
    "cohere": _cohere,
    "ollama": _ollama,
    "mock": _mock,
}

# Exposed for direct mock-mode access by the facade (aiproxy.embed) without
# going through the logging/dispatch machinery meant for real providers.
mock_provider = _mock

CHAT_PROVIDERS = {
    "huggingface": _huggingface,
    "openai": _openai,
    "ollama": _ollama,
    "cohere": _cohere,
}

RERANK_PROVIDERS = {
    "cohere": _cohere,
    "mock": _mock,
}


async def dispatch_embed(
    provider: str,
    model: str,
    texts: list[str],
    input_type: str = "search_document",
    *,
    capability: str = "embedding",
    dim: int | None = None,
) -> list[list[float]]:
    logger.info("aiproxy: %s -> %s (model=%s)", capability, provider, model)

    impl = EMBEDDING_PROVIDERS.get(provider)
    if impl is None:
        raise ValueError(f"Unsupported embedding provider: {provider}")

    if provider == "cohere":
        return await impl.embed(
            texts,
            input_type=input_type,
            model=model,
            api_key=config.get_cohere_api_key(),
            base_url=config.get_cohere_base_url(),
            capability=capability,
        )
    if provider == "ollama":
        return await impl.embed(
            texts,
            input_type=input_type,
            model=model,
            ollama_base_url=config._first_non_empty("OLLAMA_BASE_URL", default="http://localhost:11434/api"),
            capability=capability,
        )
    if provider == "mock":
        return await impl.embed(
            texts,
            input_type=input_type,
            model=model,
            dim=dim if dim is not None else 1024,
        )

    raise ValueError(f"Unsupported embedding provider: {provider}")


async def dispatch_chat(
    provider: str,
    model: str,
    messages: list[dict[str, str]],
    *,
    json_mode: bool = False,
    temperature: float = 0.0,
    max_tokens: int | None = None,
    capability: str = "chat",
) -> str:
    if provider == "mock":
        raise ValueError(f"Mock provider selected for {capability}; caller should handle mock mode.")

    logger.info("aiproxy: %s -> %s (model=%s)", capability, provider, model)

    impl = CHAT_PROVIDERS.get(provider)
    if impl is None:
        raise ValueError(f"Unsupported LLM provider: {provider}")

    if provider == "huggingface":
        return await impl.chat(
            messages,
            model=model,
            json_mode=json_mode,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=config.get_huggingface_api_key(),
            capability=capability,
        )
    if provider == "openai":
        return await impl.chat(
            messages,
            model=model,
            json_mode=json_mode,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=config._first_non_empty("OPENAI_API_KEY"),
            capability=capability,
        )
    if provider == "ollama":
        return await impl.chat(
            messages,
            model=model,
            json_mode=json_mode,
            temperature=temperature,
            max_tokens=max_tokens,
            ollama_base_url=config._first_non_empty("OLLAMA_BASE_URL", default="http://localhost:11434/api"),
            capability=capability,
        )
    if provider == "cohere":
        return await impl.chat(
            messages,
            model=model,
            json_mode=json_mode,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=config.get_cohere_api_key(),
            base_url=config.get_cohere_base_url(),
            capability=capability,
        )

    raise ValueError(f"Unsupported LLM provider: {provider}")


async def dispatch_rerank(
    provider: str,
    model: str,
    query: str,
    documents: list[str],
    top_n: int | None = None,
    *,
    capability: str = "rerank",
) -> list[dict]:
    logger.info("aiproxy: %s -> %s (model=%s)", capability, provider, model)

    impl = RERANK_PROVIDERS.get(provider)
    if impl is None:
        raise ValueError(f"Unsupported rerank provider: {provider}")

    if provider == "cohere":
        return await impl.rerank(
            query,
            documents,
            model=model,
            top_n=top_n,
            api_key=config.get_cohere_api_key(),
            base_url=config.get_cohere_base_url(),
            capability=capability,
        )
    if provider == "mock":
        return await impl.rerank(query, documents, model=model, top_n=top_n)

    raise ValueError(f"Unsupported rerank provider: {provider}")
