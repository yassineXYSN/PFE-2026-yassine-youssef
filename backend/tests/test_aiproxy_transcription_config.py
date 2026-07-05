"""Unit tests for aiproxy.config transcription resolution.

No network access, no API keys required.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from aiproxy import config

_ALL_VARS = (
    "TRANSCRIPTION_PROVIDER",
    "GROQ_API_KEY", "GROQ_STT_MODEL", "GROQ_BASE_URL",
    "OPENAI_API_KEY", "OPENAI_STT_MODEL", "OPENAI_BASE_URL",
    "DEEPGRAM_API_KEY", "DEEPGRAM_STT_MODEL", "DEEPGRAM_BASE_URL",
    "ELEVENLABS_API_KEY", "ELEVENLABS_STT_MODEL", "ELEVENLABS_BASE_URL",
    "WHISPER_MODEL", "FAKE_ANALYSIS",
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in _ALL_VARS:
        monkeypatch.delenv(name, raising=False)


class TestDefaults:
    def test_default_is_local(self):
        cfg = config.get_transcription_config()
        assert cfg.provider == "local"
        assert cfg.model == "base"          # WHISPER_MODEL default
        assert cfg.api_key == ""
        assert cfg.base_url == ""

    def test_local_model_from_whisper_model_env(self, monkeypatch):
        monkeypatch.setenv("WHISPER_MODEL", "small")
        assert config.get_transcription_config().model == "small"


class TestAliases:
    @pytest.mark.parametrize("alias", ["whisper", "faster-whisper", "faster_whisper", "LOCAL"])
    def test_local_aliases(self, monkeypatch, alias):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", alias)
        assert config.get_transcription_config().provider == "local"


class TestGroq:
    def test_groq_defaults(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "groq")
        monkeypatch.setenv("GROQ_API_KEY", "gk-test")
        cfg = config.get_transcription_config()
        assert cfg.provider == "groq"
        assert cfg.model == "whisper-large-v3-turbo"
        assert cfg.api_key == "gk-test"
        assert cfg.base_url == "https://api.groq.com/openai/v1"

    def test_groq_model_override(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "groq")
        monkeypatch.setenv("GROQ_STT_MODEL", "whisper-large-v3")
        assert config.get_transcription_config().model == "whisper-large-v3"


class TestOpenAI:
    def test_openai_defaults(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        cfg = config.get_transcription_config()
        assert cfg.provider == "openai"
        assert cfg.model == "whisper-1"
        assert cfg.api_key == "sk-test"
        assert cfg.base_url == "https://api.openai.com/v1"


class TestDeepgram:
    def test_deepgram_defaults(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "deepgram")
        monkeypatch.setenv("DEEPGRAM_API_KEY", "dg-test")
        cfg = config.get_transcription_config()
        assert cfg.provider == "deepgram"
        assert cfg.model == "nova-3"
        assert cfg.api_key == "dg-test"
        assert cfg.base_url == "https://api.deepgram.com"


class TestElevenLabs:
    def test_elevenlabs_defaults(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "elevenlabs")
        monkeypatch.setenv("ELEVENLABS_API_KEY", "el-test")
        cfg = config.get_transcription_config()
        assert cfg.provider == "elevenlabs"
        assert cfg.model == "scribe_v1"
        assert cfg.api_key == "el-test"
        assert cfg.base_url == "https://api.elevenlabs.io"


class TestMockAndFake:
    def test_mock_explicit(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "mock")
        assert config.get_transcription_config().provider == "mock"

    def test_fake_analysis_does_not_touch_transcription(self, monkeypatch):
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        assert config.get_transcription_config().provider == "local"
