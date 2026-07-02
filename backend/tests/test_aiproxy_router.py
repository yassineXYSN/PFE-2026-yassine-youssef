"""Unit tests for aiproxy.router — dispatch picks the correct provider per capability.

No network access, no API keys required. Provider implementations are
monkeypatched at the instance level so we assert routing, not HTTP behavior
(HTTP behavior is covered in test_aiproxy_providers.py).

Note: pytest-asyncio is not installed in this venv, so async coroutines are
driven with asyncio.run(...) from plain (sync) test functions.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from aiproxy import router


class _RecordingEmbedProvider:
    def __init__(self):
        self.calls = []

    async def embed(self, texts, *, input_type, model, **kwargs):
        self.calls.append({"texts": texts, "input_type": input_type, "model": model, **kwargs})
        return [[0.1, 0.2] for _ in texts]


class _RecordingChatProvider:
    def __init__(self):
        self.calls = []

    async def chat(self, messages, *, model, json_mode, temperature, max_tokens, **kwargs):
        self.calls.append(
            {
                "messages": messages,
                "model": model,
                "json_mode": json_mode,
                "temperature": temperature,
                "max_tokens": max_tokens,
                **kwargs,
            }
        )
        return "recorded-response"


class _RecordingRerankProvider:
    def __init__(self):
        self.calls = []

    async def rerank(self, query, documents, *, model, top_n, **kwargs):
        self.calls.append({"query": query, "documents": documents, "model": model, "top_n": top_n, **kwargs})
        return [{"index": 0, "relevance_score": 1.0}]


def test_dispatch_embed_routes_to_cohere(monkeypatch):
    fake = _RecordingEmbedProvider()
    monkeypatch.setitem(router.EMBEDDING_PROVIDERS, "cohere", fake)
    result = asyncio.run(router.dispatch_embed("cohere", "embed-multilingual-v3.0", ["hello"], "search_document"))
    assert result == [[0.1, 0.2]]
    assert fake.calls[0]["model"] == "embed-multilingual-v3.0"
    assert fake.calls[0]["input_type"] == "search_document"


def test_dispatch_embed_routes_to_ollama(monkeypatch):
    fake = _RecordingEmbedProvider()
    monkeypatch.setitem(router.EMBEDDING_PROVIDERS, "ollama", fake)
    result = asyncio.run(router.dispatch_embed("ollama", "nomic-embed-text", ["hi"], "search_query"))
    assert result == [[0.1, 0.2]]
    assert fake.calls[0]["model"] == "nomic-embed-text"


def test_dispatch_embed_unsupported_provider_raises():
    with pytest.raises(ValueError):
        asyncio.run(router.dispatch_embed("nonexistent", "model", ["x"], "search_document"))


def test_dispatch_chat_routes_to_huggingface(monkeypatch):
    fake = _RecordingChatProvider()
    monkeypatch.setitem(router.CHAT_PROVIDERS, "huggingface", fake)
    result = asyncio.run(router.dispatch_chat("huggingface", "some-model", [{"role": "user", "content": "hi"}]))
    assert result == "recorded-response"
    assert fake.calls[0]["model"] == "some-model"


def test_dispatch_chat_routes_to_openai(monkeypatch):
    fake = _RecordingChatProvider()
    monkeypatch.setitem(router.CHAT_PROVIDERS, "openai", fake)
    result = asyncio.run(router.dispatch_chat("openai", "gpt-4", [{"role": "user", "content": "hi"}]))
    assert result == "recorded-response"


def test_dispatch_chat_routes_to_ollama(monkeypatch):
    fake = _RecordingChatProvider()
    monkeypatch.setitem(router.CHAT_PROVIDERS, "ollama", fake)
    result = asyncio.run(router.dispatch_chat("ollama", "qwen3:8b", [{"role": "user", "content": "hi"}]))
    assert result == "recorded-response"


def test_dispatch_chat_routes_to_cohere(monkeypatch):
    fake = _RecordingChatProvider()
    monkeypatch.setitem(router.CHAT_PROVIDERS, "cohere", fake)
    result = asyncio.run(router.dispatch_chat("cohere", "command-r-plus", [{"role": "user", "content": "hi"}]))
    assert result == "recorded-response"


def test_dispatch_chat_mock_raises_value_error():
    with pytest.raises(ValueError, match="Mock provider selected"):
        asyncio.run(
            router.dispatch_chat(
                "mock", "mock", [{"role": "user", "content": "hi"}], capability="quiz_generation"
            )
        )


def test_dispatch_chat_unsupported_provider_raises():
    with pytest.raises(ValueError):
        asyncio.run(router.dispatch_chat("nonexistent", "model", [{"role": "user", "content": "hi"}]))


def test_dispatch_rerank_routes_to_cohere(monkeypatch):
    fake = _RecordingRerankProvider()
    monkeypatch.setitem(router.RERANK_PROVIDERS, "cohere", fake)
    result = asyncio.run(router.dispatch_rerank("cohere", "rerank-v3.5", "query", ["doc1", "doc2"]))
    assert result == [{"index": 0, "relevance_score": 1.0}]
    assert fake.calls[0]["query"] == "query"


def test_dispatch_rerank_unsupported_provider_raises():
    with pytest.raises(ValueError):
        asyncio.run(router.dispatch_rerank("nonexistent", "model", "q", ["d"]))
