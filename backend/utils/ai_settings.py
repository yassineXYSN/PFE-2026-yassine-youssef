import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)


def _first_non_empty(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def fake_analysis_enabled() -> bool:
    return env_flag("FAKE_ANALYSIS", False)


def get_huggingface_api_key() -> str:
    return _first_non_empty("HUGGINGFACE_API_KEY", "HF_CV_PARSING_TOKEN")


def _normalize_provider(provider: str) -> str:
    normalized = (provider or "").strip().lower()
    aliases = {
        "hf": "huggingface",
        "huggingface_api": "huggingface",
        "local": "ollama",
        "api": "huggingface",
    }
    return aliases.get(normalized, normalized or "ollama")


@dataclass(frozen=True)
class LLMSettings:
    capability: str
    provider: str
    model: str
    local_model: str
    api_model: str
    ollama_base_url: str
    huggingface_api_key: str
    openai_api_key: str

    @property
    def is_mock(self) -> bool:
        return self.provider == "mock"

    @property
    def is_api_provider(self) -> bool:
        return self.provider in {"huggingface", "openai"}


def _resolve_settings(
    capability: str,
    provider_envs: tuple[str, ...],
    local_model_envs: tuple[str, ...],
    api_model_envs: tuple[str, ...],
    default_provider: str,
    default_local_model: str = "qwen3:8b",
    default_api_model: str = "Qwen/Qwen2.5-72B-Instruct",
    legacy_method_env: str | None = None,
) -> LLMSettings:
    explicit_provider = _first_non_empty(*provider_envs)
    provider = _normalize_provider(explicit_provider or default_provider)
    legacy_method = os.getenv(legacy_method_env, "").strip() if legacy_method_env else ""

    if fake_analysis_enabled() or legacy_method == "3":
        provider = "mock"
    elif not explicit_provider and legacy_method == "1":
        provider = "huggingface"
    elif not explicit_provider and legacy_method == "0":
        provider = "ollama"

    local_model = _first_non_empty(*local_model_envs, default=default_local_model)
    api_model = _first_non_empty(*api_model_envs, default=default_api_model)
    model = "mock" if provider == "mock" else (api_model if provider in {"huggingface", "openai"} else local_model)

    return LLMSettings(
        capability=capability,
        provider=provider,
        model=model,
        local_model=local_model,
        api_model=api_model,
        ollama_base_url=_first_non_empty("OLLAMA_BASE_URL", default="http://localhost:11434/api"),
        huggingface_api_key=get_huggingface_api_key(),
        openai_api_key=_first_non_empty("OPENAI_API_KEY"),
    )


def get_quiz_generation_settings() -> LLMSettings:
    return _resolve_settings(
        capability="quiz_generation",
        provider_envs=("QUIZ_GENERATION_PROVIDER", "QUIZ_LLM_PROVIDER"),
        local_model_envs=("QUIZ_GENERATION_MODEL_LOCAL", "QUIZ_LLM_MODEL_LOCAL"),
        api_model_envs=("QUIZ_GENERATION_MODEL_API", "QUIZ_LLM_MODEL_API"),
        default_provider="ollama",
        legacy_method_env="QUIZ_METHOD",
    )


def get_quiz_analysis_settings() -> LLMSettings:
    return _resolve_settings(
        capability="quiz_analysis",
        provider_envs=("QUIZ_ANALYSIS_PROVIDER", "QUIZ_GENERATION_PROVIDER", "QUIZ_LLM_PROVIDER"),
        local_model_envs=("QUIZ_ANALYSIS_MODEL_LOCAL", "QUIZ_GENERATION_MODEL_LOCAL", "QUIZ_LLM_MODEL_LOCAL"),
        api_model_envs=("QUIZ_ANALYSIS_MODEL_API", "QUIZ_GENERATION_MODEL_API", "QUIZ_LLM_MODEL_API"),
        default_provider="ollama",
        legacy_method_env="QUIZ_METHOD",
    )


def get_profile_analysis_settings() -> LLMSettings:
    return _resolve_settings(
        capability="profile_analysis",
        provider_envs=("PROFILE_ANALYSIS_PROVIDER", "QUIZ_LLM_PROVIDER"),
        local_model_envs=("PROFILE_ANALYSIS_MODEL_LOCAL", "PROFILE_ANALYSIS_LOCAL_LLM_MODEL", "QUIZ_LLM_MODEL_LOCAL"),
        api_model_envs=("PROFILE_ANALYSIS_MODEL_API", "QUIZ_LLM_MODEL_API"),
        default_provider="ollama",
    )


def get_account_analysis_settings() -> LLMSettings:
    return _resolve_settings(
        capability="account_analysis",
        provider_envs=("ACCOUNT_ANALYSIS_PROVIDER", "PROFILE_ANALYSIS_PROVIDER"),
        local_model_envs=("ACCOUNT_ANALYSIS_MODEL_LOCAL", "PROFILE_ANALYSIS_MODEL_LOCAL", "PROFILE_ANALYSIS_LOCAL_LLM_MODEL", "QUIZ_LLM_MODEL_LOCAL"),
        api_model_envs=("ACCOUNT_ANALYSIS_MODEL_API", "PROFILE_ANALYSIS_MODEL_API", "QUIZ_LLM_MODEL_API"),
        default_provider="huggingface",
    )


def get_interview_analysis_settings() -> LLMSettings:
    return _resolve_settings(
        capability="interview_analysis",
        provider_envs=("INTERVIEW_ANALYSIS_PROVIDER", "ACCOUNT_ANALYSIS_PROVIDER", "PROFILE_ANALYSIS_PROVIDER"),
        local_model_envs=("INTERVIEW_ANALYSIS_MODEL_LOCAL", "ACCOUNT_ANALYSIS_MODEL_LOCAL", "QUIZ_LLM_MODEL_LOCAL"),
        api_model_envs=("INTERVIEW_ANALYSIS_MODEL_API", "ACCOUNT_ANALYSIS_MODEL_API", "QUIZ_LLM_MODEL_API"),
        default_provider="huggingface",
    )


def quiz_generation_is_mock() -> bool:
    return get_quiz_generation_settings().is_mock
