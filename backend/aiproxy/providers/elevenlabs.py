"""ElevenLabs provider — transcription only (Scribe).

Docs: https://elevenlabs.io/docs/api-reference/speech-to-text
"""

import httpx

from aiproxy.errors import ProviderError


class ElevenLabsProvider:
    async def transcribe(
        self,
        audio: bytes,
        *,
        model: str,
        language: str | None = None,
        api_key: str = "",
        base_url: str = "https://api.elevenlabs.io",
        capability: str = "transcription",
    ) -> str:
        if not api_key:
            raise ProviderError("elevenlabs", capability, "ELEVENLABS_API_KEY is missing.")

        data = {"model_id": model}
        if language:
            data["language_code"] = language

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{base_url.rstrip('/')}/v1/speech-to-text",
                    headers={"xi-api-key": api_key},
                    files={"file": ("audio.wav", audio, "audio/wav")},
                    data=data,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise ProviderError("elevenlabs", capability, str(exc)) from exc
            payload = response.json()

        return (payload.get("text") or "").strip()
