"""Facade + dispatch tests for aiproxy.transcribe."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

import aiproxy
from aiproxy import router


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in ("TRANSCRIPTION_PROVIDER", "GROQ_API_KEY", "FAKE_ANALYSIS"):
        monkeypatch.delenv(name, raising=False)


def test_facade_mock_provider(monkeypatch):
    monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "mock")
    result = asyncio.run(aiproxy.transcribe(b"anything"))
    assert result == "[MOCK] transcription de test."


def test_facade_filters_hallucinations(monkeypatch):
    monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "gk-test")

    async def fake_dispatch(provider, model, audio, **kwargs):
        return "Merci d'avoir regardé !"

    monkeypatch.setattr("aiproxy.dispatch_transcribe", fake_dispatch)
    result = asyncio.run(aiproxy.transcribe(b"silence"))
    assert result == ""


def test_facade_passes_language_through(monkeypatch):
    monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "gk-test")
    captured = {}

    async def fake_dispatch(provider, model, audio, **kwargs):
        captured["provider"] = provider
        captured["model"] = model
        captured["language"] = kwargs.get("language")
        return "Bonjour."

    monkeypatch.setattr("aiproxy.dispatch_transcribe", fake_dispatch)
    result = asyncio.run(aiproxy.transcribe(b"wav", language="fr"))
    assert result == "Bonjour."
    assert captured == {"provider": "groq", "model": "whisper-large-v3-turbo", "language": "fr"}


def test_dispatch_unknown_provider_raises():
    with pytest.raises(ValueError):
        asyncio.run(
            router.dispatch_transcribe("nope", "m", b"x", language=None, api_key="", base_url="")
        )


def test_dispatch_routes_groq_to_openai_compatible(monkeypatch):
    captured = {}

    async def fake_transcribe(self, audio, **kwargs):
        captured.update(kwargs)
        return "ok"

    from aiproxy.providers.openai import OpenAIProvider
    monkeypatch.setattr(OpenAIProvider, "transcribe", fake_transcribe)

    result = asyncio.run(
        router.dispatch_transcribe(
            "groq", "whisper-large-v3-turbo", b"x",
            language="fr", api_key="gk", base_url="https://api.groq.com/openai/v1",
        )
    )
    assert result == "ok"
    assert captured["api_key"] == "gk"
    assert captured["base_url"] == "https://api.groq.com/openai/v1"
