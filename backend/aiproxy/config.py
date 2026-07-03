"""Configuration resolution for the aiproxy package.

Absorbs the logic that used to live in ``utils/ai_settings.py`` (chat/LLM
per-capability resolution) and adds the new embedding / rerank / cohere
configuration introduced by the aiproxy design.

``utils/ai_settings.py`` now delegates to this module as a backward-compat
shim; every public function here is safe to import directly by new code.
"""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)


# ─────────────────────────────────────────────────────────────────────────────
# Generic helpers
# ─────────────────────────────────────────────────────────────────────────────

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
    if normalized in ("cohere",):
        return "cohere"
    return aliases.get(normalized, normalized or "ollama")


# ─────────────────────────────────────────────────────────────────────────────
# Chat / LLM settings (per-capability) — unchanged behavior from ai_settings.py
# ─────────────────────────────────────────────────────────────────────────────

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
        return self.provider in {"huggingface", "openai", "cohere"}


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
    if provider == "mock":
        model = "mock"
    elif provider == "cohere":
        model = _first_non_empty("COHERE_CHAT_MODEL", default="command-r-plus-08-2024")
    elif provider in {"huggingface", "openai"}:
        model = api_model
    else:
        model = local_model

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


CAPABILITY_SETTINGS_RESOLVERS = {
    "quiz_generation": get_quiz_generation_settings,
    "quiz_analysis": get_quiz_analysis_settings,
    "profile_analysis": get_profile_analysis_settings,
    "account_analysis": get_account_analysis_settings,
    "interview_analysis": get_interview_analysis_settings,
}


def get_llm_settings(capability: str) -> LLMSettings:
    """Resolve LLMSettings for an arbitrary chat capability name.

    Known capabilities use their dedicated resolver (preserving existing env
    fallback chains); unknown capabilities fall back to a generic resolver
    using ``<CAPABILITY>_PROVIDER`` / ``<CAPABILITY>_MODEL_LOCAL`` /
    ``<CAPABILITY>_MODEL_API`` env vars, defaulting to huggingface.
    """
    resolver = CAPABILITY_SETTINGS_RESOLVERS.get(capability)
    if resolver is not None:
        return resolver()

    prefix = capability.upper()
    return _resolve_settings(
        capability=capability,
        provider_envs=(f"{prefix}_PROVIDER",),
        local_model_envs=(f"{prefix}_MODEL_LOCAL",),
        api_model_envs=(f"{prefix}_MODEL_API",),
        default_provider="huggingface",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Cohere shared config
# ─────────────────────────────────────────────────────────────────────────────

def get_cohere_api_key() -> str:
    return _first_non_empty("COHERE_API_KEY")


def get_cohere_base_url() -> str:
    return _first_non_empty("COHERE_BASE_URL", default="https://api.cohere.com")


# ─────────────────────────────────────────────────────────────────────────────
# Embedding config
# ─────────────────────────────────────────────────────────────────────────────

_COHERE_EMBED_DIM = 1024
_OLLAMA_NOMIC_EMBED_DIM = 768

# Raw cosine-similarity range observed per provider between a job description
# and a candidate profile embedding. Used to rescale a raw similarity into a
# 0-100% match score. These are provider-specific: each embedding model has
# its own similarity distribution, so the floor/ceiling MUST be revisited
# whenever EMBEDDING_PROVIDER changes (e.g. embed-multilingual-v3.0 tops out
# much lower than nomic-embed-text does for related documents).
_COHERE_SIMILARITY_FLOOR = 0.25
_COHERE_SIMILARITY_CEILING = 0.55
_OLLAMA_SIMILARITY_FLOOR = 0.50
_OLLAMA_SIMILARITY_CEILING = 1.0


@dataclass(frozen=True)
class EmbeddingConfig:
    provider: str
    model: str
    dim: int
    similarity_floor: float
    similarity_ceiling: float
    cohere_api_key: str
    cohere_base_url: str
    ollama_base_url: str


def get_embedding_config() -> EmbeddingConfig:
    explicit_provider = _first_non_empty("EMBEDDING_PROVIDER")
    provider = _normalize_provider(explicit_provider or "cohere")
    if fake_analysis_enabled():
        provider = "mock"

    if provider == "cohere":
        model = _first_non_empty("COHERE_EMBED_MODEL", default="embed-multilingual-v3.0")
        dim = _COHERE_EMBED_DIM
        similarity_floor = _COHERE_SIMILARITY_FLOOR
        similarity_ceiling = _COHERE_SIMILARITY_CEILING
    elif provider == "ollama":
        model = _first_non_empty(
            "OLLAMA_EMBED_MODEL",
            "QUIZ_EMBEDDING_MODEL",
            "PROFILE_ANALYSIS_EMBEDDING_MODEL",
            default="nomic-embed-text",
        )
        dim = _OLLAMA_NOMIC_EMBED_DIM
        similarity_floor = _OLLAMA_SIMILARITY_FLOOR
        similarity_ceiling = _OLLAMA_SIMILARITY_CEILING
    elif provider == "mock":
        # Keep the dimension consistent with whichever real provider would
        # otherwise be active, so fake vectors match the active index.
        model = "mock"
        fallback_provider = _normalize_provider(explicit_provider or "cohere")
        is_ollama_fallback = fallback_provider == "ollama"
        dim = _OLLAMA_NOMIC_EMBED_DIM if is_ollama_fallback else _COHERE_EMBED_DIM
        similarity_floor = _OLLAMA_SIMILARITY_FLOOR if is_ollama_fallback else _COHERE_SIMILARITY_FLOOR
        similarity_ceiling = _OLLAMA_SIMILARITY_CEILING if is_ollama_fallback else _COHERE_SIMILARITY_CEILING
    else:
        model = _first_non_empty("OLLAMA_EMBED_MODEL", default="nomic-embed-text")
        dim = _OLLAMA_NOMIC_EMBED_DIM
        similarity_floor = _OLLAMA_SIMILARITY_FLOOR
        similarity_ceiling = _OLLAMA_SIMILARITY_CEILING

    return EmbeddingConfig(
        provider=provider,
        model=model,
        dim=dim,
        similarity_floor=similarity_floor,
        similarity_ceiling=similarity_ceiling,
        cohere_api_key=get_cohere_api_key(),
        cohere_base_url=get_cohere_base_url(),
        ollama_base_url=_first_non_empty("OLLAMA_BASE_URL", default="http://localhost:11434/api"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Rerank config
# ─────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class RerankConfig:
    provider: str
    model: str
    cohere_api_key: str
    cohere_base_url: str


def get_rerank_config() -> RerankConfig:
    explicit_provider = _first_non_empty("RERANK_PROVIDER")
    provider = _normalize_provider(explicit_provider or "cohere")
    if fake_analysis_enabled():
        provider = "mock"

    if provider == "cohere":
        model = _first_non_empty("COHERE_RERANK_MODEL", default="rerank-v3.5")
    else:
        model = _first_non_empty("COHERE_RERANK_MODEL", default="rerank-v3.5")

    return RerankConfig(
        provider=provider,
        model=model,
        cohere_api_key=get_cohere_api_key(),
        cohere_base_url=get_cohere_base_url(),
    )


def ai_matching_rerank_enabled() -> bool:
    return env_flag("AI_MATCHING_RERANK", False)
