"""Unit tests for aiproxy.config — defaults, env overrides, aliasing, fake mode.

No network access, no API keys required.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import importlib

import pytest

from aiproxy import config


def _reload_config():
    """Reload aiproxy.config so module-level state (none currently) is fresh."""
    importlib.reload(config)
    return config


class TestNormalizeProvider:
    def test_known_aliases(self):
        assert config._normalize_provider("hf") == "huggingface"
        assert config._normalize_provider("huggingface_api") == "huggingface"
        assert config._normalize_provider("local") == "ollama"
        assert config._normalize_provider("api") == "huggingface"

    def test_cohere_recognized(self):
        assert config._normalize_provider("cohere") == "cohere"
        assert config._normalize_provider("Cohere") == "cohere"

    def test_passthrough_and_default(self):
        assert config._normalize_provider("openai") == "openai"
        assert config._normalize_provider("") == "ollama"
        assert config._normalize_provider(None) == "ollama"


class TestEnvFlag:
    def test_default_false(self, monkeypatch):
        monkeypatch.delenv("SOME_FLAG", raising=False)
        assert config.env_flag("SOME_FLAG") is False

    def test_default_override(self, monkeypatch):
        monkeypatch.delenv("SOME_FLAG", raising=False)
        assert config.env_flag("SOME_FLAG", default=True) is True

    @pytest.mark.parametrize("value", ["1", "true", "True", "yes", "on"])
    def test_truthy_values(self, monkeypatch, value):
        monkeypatch.setenv("SOME_FLAG", value)
        assert config.env_flag("SOME_FLAG") is True

    @pytest.mark.parametrize("value", ["0", "false", "no", "off", ""])
    def test_falsy_values(self, monkeypatch, value):
        monkeypatch.setenv("SOME_FLAG", value)
        assert config.env_flag("SOME_FLAG") is False


class TestFakeAnalysis:
    def test_disabled_by_default(self, monkeypatch):
        monkeypatch.delenv("FAKE_ANALYSIS", raising=False)
        assert config.fake_analysis_enabled() is False

    def test_enabled(self, monkeypatch):
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        assert config.fake_analysis_enabled() is True


class TestEmbeddingConfig:
    def _clear_embedding_env(self, monkeypatch):
        for name in (
            "EMBEDDING_PROVIDER",
            "COHERE_EMBED_MODEL",
            "OLLAMA_EMBED_MODEL",
            "QUIZ_EMBEDDING_MODEL",
            "PROFILE_ANALYSIS_EMBEDDING_MODEL",
            "FAKE_ANALYSIS",
            "COHERE_API_KEY",
            "COHERE_BASE_URL",
        ):
            monkeypatch.delenv(name, raising=False)

    def test_default_provider_is_cohere(self, monkeypatch):
        self._clear_embedding_env(monkeypatch)
        cfg = config.get_embedding_config()
        assert cfg.provider == "cohere"
        assert cfg.model == "embed-multilingual-v3.0"
        assert cfg.dim == 1024

    def test_env_override_to_ollama(self, monkeypatch):
        self._clear_embedding_env(monkeypatch)
        monkeypatch.setenv("EMBEDDING_PROVIDER", "ollama")
        cfg = config.get_embedding_config()
        assert cfg.provider == "ollama"
        assert cfg.model == "nomic-embed-text"
        assert cfg.dim == 768

    def test_ollama_model_fallback_chain(self, monkeypatch):
        self._clear_embedding_env(monkeypatch)
        monkeypatch.setenv("EMBEDDING_PROVIDER", "ollama")
        monkeypatch.setenv("QUIZ_EMBEDDING_MODEL", "custom-quiz-model")
        cfg = config.get_embedding_config()
        assert cfg.model == "custom-quiz-model"

    def test_ollama_model_prefers_explicit_ollama_embed_model(self, monkeypatch):
        self._clear_embedding_env(monkeypatch)
        monkeypatch.setenv("EMBEDDING_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_EMBED_MODEL", "explicit-model")
        monkeypatch.setenv("QUIZ_EMBEDDING_MODEL", "custom-quiz-model")
        cfg = config.get_embedding_config()
        assert cfg.model == "explicit-model"

    def test_fake_analysis_forces_mock(self, monkeypatch):
        self._clear_embedding_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        cfg = config.get_embedding_config()
        assert cfg.provider == "mock"
        # Default (cohere) dimension preserved for mock vectors.
        assert cfg.dim == 1024

    def test_fake_analysis_with_ollama_selected_uses_ollama_dim(self, monkeypatch):
        self._clear_embedding_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        monkeypatch.setenv("EMBEDDING_PROVIDER", "ollama")
        cfg = config.get_embedding_config()
        assert cfg.provider == "mock"
        assert cfg.dim == 768

    def test_cohere_model_env_override(self, monkeypatch):
        self._clear_embedding_env(monkeypatch)
        monkeypatch.setenv("COHERE_EMBED_MODEL", "embed-english-v3.0")
        cfg = config.get_embedding_config()
        assert cfg.model == "embed-english-v3.0"

    def test_cohere_connection_settings(self, monkeypatch):
        self._clear_embedding_env(monkeypatch)
        monkeypatch.setenv("COHERE_API_KEY", "test-key-123")
        monkeypatch.setenv("COHERE_BASE_URL", "https://custom.cohere.example")
        cfg = config.get_embedding_config()
        assert cfg.cohere_api_key == "test-key-123"
        assert cfg.cohere_base_url == "https://custom.cohere.example"

    def test_cohere_base_url_default(self, monkeypatch):
        self._clear_embedding_env(monkeypatch)
        cfg = config.get_embedding_config()
        assert cfg.cohere_base_url == "https://api.cohere.com"


class TestRerankConfig:
    def _clear_rerank_env(self, monkeypatch):
        for name in ("RERANK_PROVIDER", "COHERE_RERANK_MODEL", "FAKE_ANALYSIS", "AI_MATCHING_RERANK"):
            monkeypatch.delenv(name, raising=False)

    def test_default_provider_is_cohere(self, monkeypatch):
        self._clear_rerank_env(monkeypatch)
        cfg = config.get_rerank_config()
        assert cfg.provider == "cohere"
        assert cfg.model == "rerank-v3.5"

    def test_env_override_model(self, monkeypatch):
        self._clear_rerank_env(monkeypatch)
        monkeypatch.setenv("COHERE_RERANK_MODEL", "rerank-custom")
        cfg = config.get_rerank_config()
        assert cfg.model == "rerank-custom"

    def test_fake_analysis_forces_mock(self, monkeypatch):
        self._clear_rerank_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        cfg = config.get_rerank_config()
        assert cfg.provider == "mock"

    def test_ai_matching_rerank_flag_default_off(self, monkeypatch):
        self._clear_rerank_env(monkeypatch)
        assert config.ai_matching_rerank_enabled() is False

    def test_ai_matching_rerank_flag_enabled(self, monkeypatch):
        self._clear_rerank_env(monkeypatch)
        monkeypatch.setenv("AI_MATCHING_RERANK", "true")
        assert config.ai_matching_rerank_enabled() is True


class TestLLMSettingsResolution:
    def _clear_chat_env(self, monkeypatch):
        for name in (
            "QUIZ_GENERATION_PROVIDER",
            "QUIZ_LLM_PROVIDER",
            "QUIZ_METHOD",
            "FAKE_ANALYSIS",
            "ACCOUNT_ANALYSIS_PROVIDER",
            "PROFILE_ANALYSIS_PROVIDER",
        ):
            monkeypatch.delenv(name, raising=False)

    def test_quiz_generation_default_provider(self, monkeypatch):
        self._clear_chat_env(monkeypatch)
        settings = config.get_quiz_generation_settings()
        assert settings.provider == "ollama"
        assert settings.capability == "quiz_generation"

    def test_quiz_generation_env_override(self, monkeypatch):
        self._clear_chat_env(monkeypatch)
        monkeypatch.setenv("QUIZ_GENERATION_PROVIDER", "huggingface")
        settings = config.get_quiz_generation_settings()
        assert settings.provider == "huggingface"
        assert settings.model == settings.api_model

    def test_account_analysis_default_provider(self, monkeypatch):
        self._clear_chat_env(monkeypatch)
        settings = config.get_account_analysis_settings()
        assert settings.provider == "huggingface"

    def test_fake_analysis_forces_mock_provider(self, monkeypatch):
        self._clear_chat_env(monkeypatch)
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        settings = config.get_quiz_generation_settings()
        assert settings.provider == "mock"
        assert settings.is_mock is True

    def test_cohere_alias_resolves_via_get_llm_settings(self, monkeypatch):
        self._clear_chat_env(monkeypatch)
        monkeypatch.setenv("QUIZ_GENERATION_PROVIDER", "cohere")
        settings = config.get_llm_settings("quiz_generation")
        assert settings.provider == "cohere"

    def test_get_llm_settings_unknown_capability(self, monkeypatch):
        monkeypatch.delenv("FAKE_ANALYSIS", raising=False)
        monkeypatch.delenv("SOMETHING_NEW_PROVIDER", raising=False)
        settings = config.get_llm_settings("something_new")
        assert settings.capability == "something_new"
        assert settings.provider == "huggingface"
