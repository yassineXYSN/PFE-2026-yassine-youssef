"""Ollama provider — local chat + embeddings.

Chat behavior is ported verbatim from the original
``utils/llm_client.py::_call_ollama`` (same endpoints, fallback, options).

Embeddings standardize on Ollama's ``/api/embed`` endpoint (payload
``{"model", "input": texts, "options": {...}}``), parsing
``{"embeddings": [[...], ...]}`` and tolerating the older single-vector
``{"embedding": [...]}`` shape too (used by the legacy ``/api/embeddings``
endpoint that some call sites used directly).
"""

import logging
import os
from typing import Any

import httpx

from aiproxy.errors import ProviderError

_OLLAMA_NUM_GPU = int(os.getenv("OLLAMA_NUM_GPU_LAYERS", "99"))
_OLLAMA_NUM_THREAD = int(os.getenv("OLLAMA_NUM_THREAD", "0")) or None
_OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "8192"))

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


class OllamaProvider:
    """Chat + embedding provider for a local Ollama instance."""

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str,
        json_mode: bool = False,
        temperature: float = 0.0,
        max_tokens: int | None = None,
        ollama_base_url: str = "http://localhost:11434/api",
        capability: str = "chat",
    ) -> str:
        options: dict[str, Any] = {
            "temperature": temperature,
            "num_gpu": _OLLAMA_NUM_GPU,
            "num_ctx": _OLLAMA_NUM_CTX,
        }
        if _OLLAMA_NUM_THREAD:
            options["num_thread"] = _OLLAMA_NUM_THREAD
        if max_tokens:
            options["num_predict"] = max_tokens
        if "qwen3" in model.lower():
            options["think"] = False

        generate_payload: dict[str, Any] = {
            "model": model,
            "prompt": _messages_to_prompt(messages),
            "stream": False,
            "options": options,
        }
        if json_mode:
            generate_payload["format"] = "json"

        chat_payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": options,
        }
        if json_mode:
            chat_payload["format"] = "json"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120.0, headers=headers) as client:
            try:
                response = await client.post(
                    f"{ollama_base_url}/generate",
                    json=generate_payload,
                )
                response.raise_for_status()
                data = response.json()
                return (data.get("response") or "").strip()
            except httpx.HTTPStatusError as exc:
                generate_detail = _extract_ollama_error(exc.response)
                logger.warning(
                    "Ollama /generate failed for %s with status=%s: %s. Retrying with /chat.",
                    capability,
                    exc.response.status_code,
                    generate_detail,
                )

                try:
                    chat_response = await client.post(
                        f"{ollama_base_url}/chat",
                        json=chat_payload,
                    )
                    chat_response.raise_for_status()
                    chat_data = chat_response.json()
                    return (chat_data.get("message", {}).get("content") or "").strip()
                except httpx.HTTPStatusError as chat_exc:
                    chat_detail = _extract_ollama_error(chat_exc.response)
                    raise ProviderError(
                        "ollama",
                        capability,
                        "Ollama request failed via /generate and /chat. "
                        f"/generate returned {exc.response.status_code}: {generate_detail}. "
                        f"/chat returned {chat_exc.response.status_code}: {chat_detail}.",
                    ) from chat_exc

    async def embed(
        self,
        texts: list[str],
        *,
        input_type: str = "search_document",
        model: str,
        ollama_base_url: str = "http://localhost:11434/api",
        capability: str = "embedding",
    ) -> list[list[float]]:
        payload: dict[str, Any] = {
            "model": model,
            "input": texts,
            "options": {"num_gpu": _OLLAMA_NUM_GPU},
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{ollama_base_url}/embed",
                    json=payload,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                detail = _extract_ollama_error(exc.response)
                raise ProviderError("ollama", capability, detail) from exc
            data = response.json()

        if "embeddings" in data:
            return data.get("embeddings") or []
        if "embedding" in data:
            # Tolerate the single-vector shape used by /api/embeddings.
            return [data.get("embedding") or []]
        return []
