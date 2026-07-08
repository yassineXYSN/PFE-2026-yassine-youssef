"""Unit tests for the aiproxy public facade (embed/chat/rerank + sync variants).

No network access, no API keys required. Provider dispatch is monkeypatched
where a real call would occur.
"""

import asyncio
import os
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

import aiproxy
from aiproxy.errors import AIProxyError


def _clear_embedding_env(monkeypatch):
    for name in ("EMBEDDING_PROVIDER", "FAKE_ANALYSIS", "COHERE_EMBED_MODEL"):
        monkeypatch.delenv(name, raising=False)


def _clear_chat_env(monkeypatch):
    for name in ("FAKE_ANALYSIS", "QUIZ_GENERATION_PROVIDER", "QUIZ_LLM_PROVIDER", "QUIZ_METHOD"):
        monkeypatch.delenv(name, raising=False)


class TestEmbedFacade:
    def test_embed_single_string_fake_mode_returns_single_vector(self, monkeypatch):
        _clear_embedding_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        result = asyncio.run(aiproxy.embed("hello world"))
        assert isinstance(result, list)
        assert len(result) == 1024  # default cohere dim
        assert all(isinstance(x, float) for x in result)

    def test_embed_list_fake_mode_returns_list_of_vectors(self, monkeypatch):
        _clear_embedding_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        result = asyncio.run(aiproxy.embed(["a", "b", "c"]))
        assert len(result) == 3
        assert all(len(v) == 1024 for v in result)

    def test_embed_fake_mode_deterministic(self, monkeypatch):
        _clear_embedding_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        v1 = asyncio.run(aiproxy.embed("stable text"))
        v2 = asyncio.run(aiproxy.embed("stable text"))
        assert v1 == v2

    def test_embed_fake_mode_ollama_dim(self, monkeypatch):
        _clear_embedding_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        monkeypatch.setenv("EMBEDDING_PROVIDER", "ollama")
        result = asyncio.run(aiproxy.embed("hello"))
        assert len(result) == 768

    def test_embed_mock_provider_without_fake_flag(self, monkeypatch):
        _clear_embedding_env(monkeypatch)
        monkeypatch.setenv("EMBEDDING_PROVIDER", "mock")
        result = asyncio.run(aiproxy.embed("hello"))
        assert len(result) == 1024

    def test_embed_real_provider_dispatches(self, monkeypatch):
        _clear_embedding_env(monkeypatch)

        async def fake_dispatch_embed(provider, model, texts, input_type, **kwargs):
            assert provider == "cohere"
            return [[9.0, 9.0] for _ in texts]

        monkeypatch.setattr(aiproxy, "dispatch_embed", fake_dispatch_embed)
        result = asyncio.run(aiproxy.embed(["x", "y"]))
        assert result == [[9.0, 9.0], [9.0, 9.0]]


class TestChatFacade:
    def test_chat_mock_provider_raises_value_error(self, monkeypatch):
        _clear_chat_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        with pytest.raises(ValueError, match="Mock provider selected"):
            asyncio.run(aiproxy.chat([{"role": "user", "content": "hi"}], capability="quiz_generation"))

    def test_chat_dispatches_to_resolved_provider(self, monkeypatch):
        _clear_chat_env(monkeypatch)
        monkeypatch.setenv("QUIZ_GENERATION_PROVIDER", "huggingface")

        async def fake_dispatch_chat(provider, model, messages, **kwargs):
            assert provider == "huggingface"
            return "chat-response"

        monkeypatch.setattr(aiproxy, "dispatch_chat", fake_dispatch_chat)
        result = asyncio.run(aiproxy.chat([{"role": "user", "content": "hi"}], capability="quiz_generation"))
        assert result == "chat-response"


class TestRerankFacade:
    def test_rerank_dispatches_to_resolved_provider(self, monkeypatch):
        for name in ("RERANK_PROVIDER", "FAKE_ANALYSIS"):
            monkeypatch.delenv(name, raising=False)

        async def fake_dispatch_rerank(provider, model, query, documents, top_n, **kwargs):
            assert provider == "cohere"
            return [{"index": 0, "relevance_score": 1.0}]

        monkeypatch.setattr(aiproxy, "dispatch_rerank", fake_dispatch_rerank)
        result = asyncio.run(aiproxy.rerank("q", ["d1", "d2"]))
        assert result == [{"index": 0, "relevance_score": 1.0}]


class TestSyncWrappers:
    def test_embed_sync_from_plain_thread(self, monkeypatch):
        _clear_embedding_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        result = aiproxy.embed_sync("hello")
        assert len(result) == 1024

    def test_chat_sync_from_plain_thread(self, monkeypatch):
        _clear_chat_env(monkeypatch)
        monkeypatch.setenv("QUIZ_GENERATION_PROVIDER", "huggingface")

        async def fake_dispatch_chat(provider, model, messages, **kwargs):
            return "sync-chat-response"

        monkeypatch.setattr(aiproxy, "dispatch_chat", fake_dispatch_chat)
        result = aiproxy.chat_sync([{"role": "user", "content": "hi"}], capability="quiz_generation")
        assert result == "sync-chat-response"

    def test_embed_sync_raises_inside_running_loop(self, monkeypatch):
        _clear_embedding_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")

        async def call_embed_sync_from_loop():
            return aiproxy.embed_sync("hello")

        with pytest.raises(AIProxyError):
            asyncio.run(call_embed_sync_from_loop())

    def test_chat_sync_raises_inside_running_loop(self, monkeypatch):
        _clear_chat_env(monkeypatch)
        monkeypatch.setenv("QUIZ_GENERATION_PROVIDER", "huggingface")

        async def fake_dispatch_chat(provider, model, messages, **kwargs):
            return "unused"

        monkeypatch.setattr(aiproxy, "dispatch_chat", fake_dispatch_chat)

        async def call_chat_sync_from_loop():
            return aiproxy.chat_sync([{"role": "user", "content": "hi"}], capability="quiz_generation")

        with pytest.raises(AIProxyError):
            asyncio.run(call_chat_sync_from_loop())

    def test_embed_sync_works_from_background_thread(self, monkeypatch):
        _clear_embedding_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        results = {}

        def worker():
            results["vec"] = aiproxy.embed_sync("hello")

        t = threading.Thread(target=worker)
        t.start()
        t.join()
        assert len(results["vec"]) == 1024
