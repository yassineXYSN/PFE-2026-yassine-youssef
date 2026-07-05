"""Request/response shape tests for aiproxy transcription providers.

Mocks httpx.AsyncClient.post (same approach as test_aiproxy_providers.py).
No network access, no real API keys.
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
import pytest

from aiproxy.errors import ProviderError
from aiproxy.providers.openai import OpenAIProvider


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
    async def fake_post(self, url, **kwargs):
        capture["url"] = url
        capture.update(kwargs)
        return _FakeResponse(status_code, response_payload)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)


# ─────────────────────────────────────────────────────────────────────────────
# OpenAI-compatible (OpenAI + Groq)
# ─────────────────────────────────────────────────────────────────────────────

def test_openai_compatible_transcribe_request_and_parsing(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"text": " Bonjour tout le monde. "})

    provider = OpenAIProvider()
    result = asyncio.run(
        provider.transcribe(
            b"RIFFfakewav",
            model="whisper-large-v3-turbo",
            language="fr",
            api_key="gk-test",
            base_url="https://api.groq.com/openai/v1",
        )
    )

    assert result == "Bonjour tout le monde."
    assert capture["url"] == "https://api.groq.com/openai/v1/audio/transcriptions"
    assert capture["headers"]["Authorization"] == "Bearer gk-test"
    assert capture["files"]["file"] == ("audio.wav", b"RIFFfakewav", "audio/wav")
    assert capture["data"]["model"] == "whisper-large-v3-turbo"
    assert capture["data"]["language"] == "fr"
    assert capture["data"]["response_format"] == "json"


def test_openai_compatible_transcribe_omits_language_when_none(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"text": "hello"})

    provider = OpenAIProvider()
    asyncio.run(provider.transcribe(b"x", model="whisper-1", api_key="sk-test"))

    assert "language" not in capture["data"]
    assert capture["url"] == "https://api.openai.com/v1/audio/transcriptions"


def test_openai_compatible_transcribe_missing_key_raises(monkeypatch):
    provider = OpenAIProvider()
    with pytest.raises(ProviderError):
        asyncio.run(provider.transcribe(b"x", model="whisper-1", api_key=""))


def test_openai_compatible_transcribe_http_error_raises(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"error": "rate limit"}, status_code=429)

    provider = OpenAIProvider()
    with pytest.raises(ProviderError):
        asyncio.run(provider.transcribe(b"x", model="whisper-1", api_key="sk-test"))


# ─────────────────────────────────────────────────────────────────────────────
# Deepgram
# ─────────────────────────────────────────────────────────────────────────────

from aiproxy.providers.deepgram import DeepgramProvider


def test_deepgram_transcribe_request_and_parsing(monkeypatch):
    capture = {}
    canned = {
        "results": {
            "channels": [
                {"alternatives": [{"transcript": "Bonjour à tous.", "confidence": 0.98}]}
            ]
        }
    }
    _patch_post(monkeypatch, capture, canned)

    provider = DeepgramProvider()
    result = asyncio.run(
        provider.transcribe(b"RIFFfakewav", model="nova-3", language="fr", api_key="dg-test")
    )

    assert result == "Bonjour à tous."
    assert capture["url"] == "https://api.deepgram.com/v1/listen"
    assert capture["headers"]["Authorization"] == "Token dg-test"
    assert capture["headers"]["Content-Type"] == "audio/wav"
    assert capture["params"]["model"] == "nova-3"
    assert capture["params"]["language"] == "fr"
    assert capture["params"]["smart_format"] == "true"
    assert capture["content"] == b"RIFFfakewav"


def test_deepgram_transcribe_empty_results_returns_empty(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"results": {"channels": []}})

    provider = DeepgramProvider()
    result = asyncio.run(provider.transcribe(b"x", model="nova-3", api_key="dg-test"))
    assert result == ""


def test_deepgram_missing_key_raises():
    provider = DeepgramProvider()
    with pytest.raises(ProviderError):
        asyncio.run(provider.transcribe(b"x", model="nova-3", api_key=""))
