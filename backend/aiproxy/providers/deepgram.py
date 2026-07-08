"""Deepgram provider — transcription only.

Prerecorded (batch) endpoint: raw audio bytes to POST /v1/listen.
Docs: https://developers.deepgram.com/docs/pre-recorded-audio
"""

import httpx

from aiproxy.errors import ProviderError


class DeepgramProvider:
    async def transcribe(
        self,
        audio: bytes,
        *,
        model: str,
        language: str | None = None,
        api_key: str = "",
        base_url: str = "https://api.deepgram.com",
        capability: str = "transcription",
    ) -> str:
        if not api_key:
            raise ProviderError("deepgram", capability, "DEEPGRAM_API_KEY is missing.")

        params = {"model": model, "smart_format": "true"}
        if language:
            params["language"] = language

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{base_url.rstrip('/')}/v1/listen",
                    headers={
                        "Authorization": f"Token {api_key}",
                        "Content-Type": "audio/wav",
                    },
                    params=params,
                    content=audio,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise ProviderError("deepgram", capability, str(exc)) from exc
            payload = response.json()

        channels = (payload.get("results") or {}).get("channels") or []
        if not channels:
            return ""
        alternatives = channels[0].get("alternatives") or []
        if not alternatives:
            return ""
        return (alternatives[0].get("transcript") or "").strip()
