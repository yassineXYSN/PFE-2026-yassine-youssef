"""Local faster-whisper transcription provider.

Thin adapter over ``services.transcription.WhisperService`` so the local
model stays selectable behind the same aiproxy dispatch as API providers
(``TRANSCRIPTION_PROVIDER=local``). The import is deliberately lazy:
API-only deployments must never import faster-whisper/torch.
"""


class LocalWhisperProvider:
    async def transcribe(
        self,
        audio: bytes,
        *,
        model: str = "",
        language: str | None = None,
        capability: str = "transcription",
        **_,
    ) -> str:
        from services.transcription import get_whisper_service  # lazy: torch-heavy

        service = get_whisper_service()
        return await service.transcribe(audio, language=language)
