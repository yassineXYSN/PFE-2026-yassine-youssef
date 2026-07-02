"""Unit tests for aiproxy provider request/response shape.

Mocks the httpx layer (monkeypatch httpx.AsyncClient.post — respx is not
installed in this venv) and asserts request URL/headers/body shape plus
correct parsing of canned responses, for:
  - Cohere embed
  - Cohere rerank
  - Cohere chat
  - HuggingFace chat (the one non-Cohere chat provider)
  - Ollama embed (dimension-tolerant parsing)

No network access, no real API keys used.
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
import pytest

from aiproxy.errors import ConfigError, ProviderError
from aiproxy.providers.cohere import CohereProvider
from aiproxy.providers.huggingface import HuggingFaceProvider
from aiproxy.providers.ollama import OllamaProvider


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)
        self.request = httpx.Request("POST", "https://example.test/")

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=self.request, response=self)


def _patch_post(monkeypatch, capture, response_payload, status_code=200):
    async def fake_post(self, url, *, headers=None, json=None, **kwargs):
        capture["url"] = url
        capture["headers"] = headers
        capture["json"] = json
        return _FakeResponse(status_code, response_payload)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)


# ─────────────────────────────────────────────────────────────────────────────
# Cohere embed
# ─────────────────────────────────────────────────────────────────────────────

def test_cohere_embed_request_and_parsing(monkeypatch):
    capture = {}
    canned_response = {"embeddings": {"float": [[0.1, 0.2, 0.3]]}}
    _patch_post(monkeypatch, capture, canned_response)

    provider = CohereProvider()
    result = asyncio.run(
        provider.embed(
            ["hello world"],
            input_type="search_document",
            model="embed-multilingual-v3.0",
            api_key="test-key",
            base_url="https://api.cohere.com",
        )
    )

    assert result == [[0.1, 0.2, 0.3]]
    assert capture["url"] == "https://api.cohere.com/v2/embed"
    assert capture["headers"]["Authorization"] == "Bearer test-key"
    assert capture["json"]["model"] == "embed-multilingual-v3.0"
    assert capture["json"]["texts"] == ["hello world"]
    assert capture["json"]["input_type"] == "search_document"
    assert capture["json"]["embedding_types"] == ["float"]


def test_cohere_embed_chunks_over_batch_limit(monkeypatch):
    capture = {"calls": []}

    async def fake_post(self, url, *, headers=None, json=None, **kwargs):
        capture["calls"].append(json)
        n = len(json["texts"])
        return _FakeResponse(200, {"embeddings": {"float": [[0.0] for _ in range(n)]}})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    provider = CohereProvider()
    texts = [f"text-{i}" for i in range(150)]
    result = asyncio.run(
        provider.embed(texts, input_type="search_document", model="embed-multilingual-v3.0", api_key="k")
    )

    assert len(result) == 150
    assert len(capture["calls"]) == 2
    assert len(capture["calls"][0]["texts"]) == 96
    assert len(capture["calls"][1]["texts"]) == 54


def test_cohere_embed_missing_key_raises_config_error():
    provider = CohereProvider()
    with pytest.raises(ConfigError):
        asyncio.run(provider.embed(["x"], input_type="search_document", model="m", api_key=""))


def test_cohere_embed_http_error_raises_provider_error(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"message": "invalid request"}, status_code=400)

    provider = CohereProvider()
    with pytest.raises(ProviderError) as exc_info:
        asyncio.run(provider.embed(["x"], input_type="search_document", model="m", api_key="k"))
    assert exc_info.value.provider == "cohere"


# ─────────────────────────────────────────────────────────────────────────────
# Cohere rerank
# ─────────────────────────────────────────────────────────────────────────────

def test_cohere_rerank_request_and_parsing(monkeypatch):
    capture = {}
    canned_response = {
        "results": [
            {"index": 1, "relevance_score": 0.9},
            {"index": 0, "relevance_score": 0.3},
        ]
    }
    _patch_post(monkeypatch, capture, canned_response)

    provider = CohereProvider()
    result = asyncio.run(
        provider.rerank(
            "query text",
            ["doc a", "doc b"],
            model="rerank-v3.5",
            top_n=2,
            api_key="test-key",
            base_url="https://api.cohere.com",
        )
    )

    assert capture["url"] == "https://api.cohere.com/v2/rerank"
    assert capture["json"]["query"] == "query text"
    assert capture["json"]["documents"] == ["doc a", "doc b"]
    assert capture["json"]["top_n"] == 2
    # sorted descending by relevance_score
    assert result[0]["index"] == 1
    assert result[1]["index"] == 0


def test_cohere_rerank_missing_key_raises_config_error():
    provider = CohereProvider()
    with pytest.raises(ConfigError):
        asyncio.run(provider.rerank("q", ["d"], model="m", api_key=""))


# ─────────────────────────────────────────────────────────────────────────────
# Cohere chat
# ─────────────────────────────────────────────────────────────────────────────

def test_cohere_chat_request_and_parsing(monkeypatch):
    capture = {}
    canned_response = {"message": {"content": [{"type": "text", "text": "hello from cohere"}]}}
    _patch_post(monkeypatch, capture, canned_response)

    provider = CohereProvider()
    result = asyncio.run(
        provider.chat(
            [{"role": "user", "content": "hi"}],
            model="command-r-plus",
            json_mode=True,
            api_key="test-key",
            base_url="https://api.cohere.com",
        )
    )

    assert result == "hello from cohere"
    assert capture["url"] == "https://api.cohere.com/v2/chat"
    assert capture["json"]["response_format"] == {"type": "json_object"}
    assert capture["headers"]["Authorization"] == "Bearer test-key"


def test_cohere_chat_missing_key_raises_config_error():
    provider = CohereProvider()
    with pytest.raises(ConfigError):
        asyncio.run(provider.chat([{"role": "user", "content": "hi"}], model="m", api_key=""))


# ─────────────────────────────────────────────────────────────────────────────
# HuggingFace chat
# ─────────────────────────────────────────────────────────────────────────────

def test_huggingface_chat_request_and_parsing(monkeypatch):
    capture = {}
    canned_response = {"choices": [{"message": {"content": "hello from hf"}}]}
    _patch_post(monkeypatch, capture, canned_response)

    provider = HuggingFaceProvider()
    result = asyncio.run(
        provider.chat(
            [{"role": "user", "content": "hi"}],
            model="Qwen/Qwen2.5-72B-Instruct",
            api_key="hf-key",
        )
    )

    assert result == "hello from hf"
    assert capture["url"] == "https://router.huggingface.co/v1/chat/completions"
    assert capture["headers"]["Authorization"] == "Bearer hf-key"
    assert capture["json"]["model"] == "Qwen/Qwen2.5-72B-Instruct"


def test_huggingface_chat_missing_key_raises():
    provider = HuggingFaceProvider()
    with pytest.raises(ProviderError):
        asyncio.run(provider.chat([{"role": "user", "content": "hi"}], model="m", api_key=""))


# ─────────────────────────────────────────────────────────────────────────────
# Ollama embed (dimension-tolerant parsing)
# ─────────────────────────────────────────────────────────────────────────────

def test_ollama_embed_multi_shape(monkeypatch):
    capture = {}
    canned_response = {"embeddings": [[0.5, 0.6]]}
    _patch_post(monkeypatch, capture, canned_response)

    provider = OllamaProvider()
    result = asyncio.run(
        provider.embed(["hi"], input_type="search_document", model="nomic-embed-text")
    )

    assert result == [[0.5, 0.6]]
    assert capture["url"].endswith("/embed")
    assert capture["json"]["model"] == "nomic-embed-text"
    assert capture["json"]["input"] == ["hi"]


def test_ollama_embed_tolerates_single_embedding_shape(monkeypatch):
    capture = {}
    canned_response = {"embedding": [0.7, 0.8]}
    _patch_post(monkeypatch, capture, canned_response)

    provider = OllamaProvider()
    result = asyncio.run(
        provider.embed(["hi"], input_type="search_document", model="nomic-embed-text")
    )

    assert result == [[0.7, 0.8]]
