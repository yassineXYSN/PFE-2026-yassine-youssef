"""Backward-compat shim.

The actual per-provider HTTP logic now lives in ``aiproxy.providers.*``,
dispatched via ``aiproxy.router.dispatch_chat``. This module keeps the
historical ``generate_chat_completion`` signature so existing callers that
pass an ``LLMSettings`` keep working unchanged.
"""

import logging

from aiproxy.router import dispatch_chat
from utils.ai_settings import LLMSettings

logger = logging.getLogger(__name__)


async def generate_chat_completion(
    messages: list[dict[str, str]],
    settings: LLMSettings,
    *,
    json_mode: bool = False,
    temperature: float = 0.0,
    max_tokens: int | None = None,
) -> str:
    return await dispatch_chat(
        settings.provider,
        settings.model,
        messages,
        json_mode=json_mode,
        temperature=temperature,
        max_tokens=max_tokens,
        capability=settings.capability,
    )
