"""Backward-compat shim.

This module used to own all LLM configuration resolution. That logic now
lives in ``aiproxy.config``; this file re-exports every public symbol so
existing imports (``from utils.ai_settings import ...``) keep working
unchanged. Do not remove or rename anything here without checking call sites.
"""

from aiproxy.config import (
    LLMSettings,
    env_flag,
    fake_analysis_enabled,
    get_account_analysis_settings,
    get_huggingface_api_key,
    get_interview_analysis_settings,
    get_profile_analysis_settings,
    get_quiz_analysis_settings,
    get_quiz_generation_settings,
    quiz_generation_is_mock,
)

__all__ = [
    "LLMSettings",
    "env_flag",
    "fake_analysis_enabled",
    "get_huggingface_api_key",
    "get_quiz_generation_settings",
    "get_quiz_analysis_settings",
    "get_profile_analysis_settings",
    "get_account_analysis_settings",
    "get_interview_analysis_settings",
    "quiz_generation_is_mock",
]
