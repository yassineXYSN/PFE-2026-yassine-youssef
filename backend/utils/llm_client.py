import logging
from typing import Any

import httpx

from utils.ai_settings import LLMSettings


logger = logging.getLogger(__name__)


def _messages_to_prompt(messages: list[dict[str, str]]) -> str:
    rendered: list[str] = []
    for message in messages:
        role = (message.get("role") or "user").upper()
        content = message.get("content") or ""
        rendered.append(f"{role}:\n{content}")
    rendered.append("ASSISTANT:")
    return "\n\n".join(rendered)


def _extract_ollama_error(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        body = (response.text or "").strip()
        return body[:500] or f"HTTP {response.status_code}"

    if isinstance(data, dict):
        detail = data.get("error") or data.get("message") or data.get("detail")
        if detail:
            return str(detail)

    return str(data)[:500]


async def _call_ollama(
    messages: list[dict[str, str]],
    settings: LLMSettings,
    *,
    json_mode: bool,
    temperature: float,
    max_tokens: int | None,
) -> str:
    options: dict[str, Any] = {"temperature": temperature}
    if max_tokens:
        options["num_predict"] = max_tokens

    generate_payload: dict[str, Any] = {
        "model": settings.model,
        "prompt": _messages_to_prompt(messages),
        "stream": False,
        "options": options,
    }
    if json_mode:
        generate_payload["format"] = "json"

    chat_payload: dict[str, Any] = {
        "model": settings.model,
        "messages": messages,
        "stream": False,
        "options": options,
    }
    if json_mode:
        chat_payload["format"] = "json"

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{settings.ollama_base_url}/generate",
                json=generate_payload,
            )
            response.raise_for_status()
            data = response.json()
            return (data.get("response") or "").strip()
        except httpx.HTTPStatusError as exc:
            generate_detail = _extract_ollama_error(exc.response)
            logger.warning(
                "Ollama /generate failed for %s with status=%s: %s. Retrying with /chat.",
                settings.capability,
                exc.response.status_code,
                generate_detail,
            )

            try:
                chat_response = await client.post(
                    f"{settings.ollama_base_url}/chat",
                    json=chat_payload,
                )
                chat_response.raise_for_status()
                chat_data = chat_response.json()
                return (chat_data.get("message", {}).get("content") or "").strip()
            except httpx.HTTPStatusError as chat_exc:
                chat_detail = _extract_ollama_error(chat_exc.response)
                raise RuntimeError(
                    "Ollama request failed via /generate and /chat. "
                    f"/generate returned {exc.response.status_code}: {generate_detail}. "
                    f"/chat returned {chat_exc.response.status_code}: {chat_detail}."
                ) from chat_exc


async def _call_huggingface(
    messages: list[dict[str, str]],
    settings: LLMSettings,
    *,
    temperature: float,
    max_tokens: int | None,
) -> str:
    if not settings.huggingface_api_key:
        raise ValueError("HUGGINGFACE_API_KEY is missing.")

    payload: dict[str, Any] = {
        "model": settings.model,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://router.huggingface.co/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.huggingface_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    return (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )


async def _call_openai(
    messages: list[dict[str, str]],
    settings: LLMSettings,
    *,
    json_mode: bool,
    temperature: float,
    max_tokens: int | None,
) -> str:
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY is missing.")

    payload: dict[str, Any] = {
        "model": settings.model,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    if max_tokens:
        payload["max_tokens"] = max_tokens

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    return (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )


async def generate_chat_completion(
    messages: list[dict[str, str]],
    settings: LLMSettings,
    *,
    json_mode: bool = False,
    temperature: float = 0.0,
    max_tokens: int | None = None,
) -> str:
    if settings.provider == "mock":
        raise ValueError(f"Mock provider selected for {settings.capability}; caller should handle mock mode.")

    logger.info(
        "Calling %s for %s with model=%s",
        settings.provider,
        settings.capability,
        settings.model,
    )

    if settings.provider == "huggingface":
        return await _call_huggingface(
            messages,
            settings,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    if settings.provider == "openai":
        return await _call_openai(
            messages,
            settings,
            json_mode=json_mode,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    if settings.provider == "ollama":
        return await _call_ollama(
            messages,
            settings,
            json_mode=json_mode,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    raise ValueError(f"Unsupported LLM provider: {settings.provider}")
