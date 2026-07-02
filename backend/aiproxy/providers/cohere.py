"""Cohere provider — embed (v2), chat (v2), rerank (v2). httpx-based.

API shapes per the aiproxy design spec:

- Embed:  POST {base}/v2/embed
          body: {"model", "texts": [...], "input_type": "search_document"|"search_query",
                 "embedding_types": ["float"]}
          response: {"embeddings": {"float": [[...], ...]}}
          Batch limit 96 texts/call — chunk larger inputs.
- Chat:   POST {base}/v2/chat
          body: {"model", "messages": [{"role","content"}], ...}
          response: message.content[0].text
          JSON mode -> response_format={"type": "json_object"}
- Rerank: POST {base}/v2/rerank
          body: {"model", "query", "documents": [...], "top_n"}
          response: {"results": [{"index", "relevance_score"}]}
"""

from typing import Any

import httpx

from aiproxy.errors import ConfigError, ProviderError

_EMBED_BATCH_LIMIT = 96


def _chunk(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


class CohereProvider:
    async def embed(
        self,
        texts: list[str],
        *,
        input_type: str = "search_document",
        model: str,
        api_key: str = "",
        base_url: str = "https://api.cohere.com",
        capability: str = "embedding",
    ) -> list[list[float]]:
        if not api_key or not api_key.strip():
            raise ConfigError("COHERE_API_KEY is missing or blank; cannot call Cohere embed.")

        all_embeddings: list[list[float]] = []
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            for batch in _chunk(texts, _EMBED_BATCH_LIMIT) or [[]]:
                payload: dict[str, Any] = {
                    "model": model,
                    "texts": batch,
                    "input_type": input_type,
                    "embedding_types": ["float"],
                }
                try:
                    response = await client.post(
                        f"{base_url}/v2/embed",
                        headers=headers,
                        json=payload,
                    )
                    response.raise_for_status()
                except httpx.HTTPStatusError as exc:
                    raise ProviderError("cohere", capability, _http_error_detail(exc)) from exc
                data = response.json()
                batch_embeddings = data.get("embeddings", {}).get("float", [])
                all_embeddings.extend(batch_embeddings)

        return all_embeddings

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str,
        json_mode: bool = False,
        temperature: float = 0.0,
        max_tokens: int | None = None,
        api_key: str = "",
        base_url: str = "https://api.cohere.com",
        capability: str = "chat",
    ) -> str:
        if not api_key or not api_key.strip():
            raise ConfigError("COHERE_API_KEY is missing or blank; cannot call Cohere chat.")

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        if max_tokens:
            payload["max_tokens"] = max_tokens

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    f"{base_url}/v2/chat",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise ProviderError("cohere", capability, _http_error_detail(exc)) from exc
            data = response.json()

        content = data.get("message", {}).get("content", [])
        if content and isinstance(content, list):
            return (content[0].get("text") or "").strip()
        return ""

    async def rerank(
        self,
        query: str,
        documents: list[str],
        *,
        model: str,
        top_n: int | None = None,
        api_key: str = "",
        base_url: str = "https://api.cohere.com",
        capability: str = "rerank",
    ) -> list[dict]:
        if not api_key or not api_key.strip():
            raise ConfigError("COHERE_API_KEY is missing or blank; cannot call Cohere rerank.")

        payload: dict[str, Any] = {
            "model": model,
            "query": query,
            "documents": documents,
        }
        if top_n is not None:
            payload["top_n"] = top_n

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{base_url}/v2/rerank",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise ProviderError("cohere", capability, _http_error_detail(exc)) from exc
            data = response.json()

        results = data.get("results", [])
        return sorted(results, key=lambda r: r.get("relevance_score", 0.0), reverse=True)


def _http_error_detail(exc: httpx.HTTPStatusError) -> str:
    response = exc.response
    try:
        payload = response.json()
        if isinstance(payload, dict):
            detail = payload.get("message") or payload.get("error") or payload.get("detail")
            if detail:
                return str(detail)
        return str(payload)
    except ValueError:
        return (response.text or "").strip() or f"HTTP {response.status_code}"
