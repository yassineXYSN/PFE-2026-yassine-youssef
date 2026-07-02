"""OpenAI provider — chat only.

Ported verbatim from ``utils/llm_client.py::_call_openai``.
"""

from typing import Any

import httpx

from aiproxy.errors import ProviderError


class OpenAIProvider:
    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str,
        json_mode: bool = False,
        temperature: float = 0.0,
        max_tokens: int | None = None,
        api_key: str = "",
        capability: str = "chat",
    ) -> str:
        if not api_key:
            raise ProviderError("openai", capability, "OPENAI_API_KEY is missing.")

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        if max_tokens:
            payload["max_tokens"] = max_tokens

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise ProviderError("openai", capability, str(exc)) from exc
            data = response.json()

        return (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
