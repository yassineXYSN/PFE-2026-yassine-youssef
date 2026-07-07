# Interview AI → API-Based Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the interview AI demo-deployable: transcription becomes a swappable aiproxy capability (Groq/OpenAI/Deepgram/ElevenLabs/local/mock), voice emotion is removed entirely, and face analysis gets a browser/server engine switch (browser default, existing server path preserved).

**Architecture:** Transcription joins `embed`/`chat`/`rerank` as the fourth aiproxy capability — same layering: `config.py` resolves `TRANSCRIPTION_PROVIDER` → `router.py` dispatches → one small provider file per vendor. The existing local faster-whisper service is wrapped as provider `local` (lazy import, so API-only deploys never load torch). Face analysis moves client-side via `@mediapipe/tasks-vision` behind `VITE_FACE_ANALYSIS_ENGINE`, with the current server WebSocket path kept intact as the `server` engine.

**Tech Stack:** FastAPI + httpx (backend), pytest (backend tests), React 19 + Vite 7, `@mediapipe/tasks-vision` (browser face analysis, self-hosted WASM + model — no CDN).

## Global Constraints

- Work on a new branch `dev_feature_5` created from `dev_feature_4` (Task 0).
- Backend commands run **from `backend/`** with the venv python: `venv\Scripts\python.exe -m pytest ...` (Windows).
- Frontend commands run from `frontend/`: `npm run lint`, `npm run build`. There is **no frontend test runner** — frontend tasks end with lint + build + a manual browser check.
- **Never commit secrets.** API keys go into `backend/.env` by hand (`GROQ_API_KEY=...`, etc.). The repo default for `TRANSCRIPTION_PROVIDER` is `local` so nothing breaks without keys.
- **Do not delete old work**: `services/transcription.py` (faster-whisper) stays and is reachable via `TRANSCRIPTION_PROVIDER=local`; the server face-analysis WebSocket (`/ai/ws/analyze`, `face_analyzer.py`) stays reachable via `VITE_FACE_ANALYSIS_ENGINE=server`. Voice emotion (wav2vec2) is the one thing deliberately deleted.
- `transformers` **stays** in `requirements.txt` — `utils/cv_parser.py:427` imports it. Only the wav2vec2 usage is removed.
- Transcription is **independent of `FAKE_ANALYSIS`** (matches today's behavior: live transcripts still work in fake mode). Mock transcription only via explicit `TRANSCRIPTION_PROVIDER=mock`.
- The Python edit hook strips unused imports: when adding a new import to a backend file, make the same Edit also add its first usage.
- French is the default interview language; `language` (e.g. `"fr"`) flows from the client and must be forwarded to every provider.

## Env Vars Introduced (document in Task 13)

| Var | Default | Used by |
|---|---|---|
| `TRANSCRIPTION_PROVIDER` | `local` | provider selection: `local` \| `groq` \| `openai` \| `deepgram` \| `elevenlabs` \| `mock` |
| `GROQ_API_KEY` / `GROQ_STT_MODEL` / `GROQ_BASE_URL` | — / `whisper-large-v3-turbo` / `https://api.groq.com/openai/v1` | groq |
| `OPENAI_API_KEY` (existing) / `OPENAI_STT_MODEL` / `OPENAI_BASE_URL` | — / `whisper-1` / `https://api.openai.com/v1` | openai |
| `DEEPGRAM_API_KEY` / `DEEPGRAM_STT_MODEL` / `DEEPGRAM_BASE_URL` | — / `nova-3` / `https://api.deepgram.com` | deepgram |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_STT_MODEL` / `ELEVENLABS_BASE_URL` | — / `scribe_v1` / `https://api.elevenlabs.io` | elevenlabs |
| `WHISPER_MODEL` (existing) | `base` | local |
| `VITE_FACE_ANALYSIS_ENGINE` (frontend) | `browser` | `browser` \| `server` face engine |

---

### Task 0: Branch

**Files:** none (git only)

- [ ] **Step 1: Create the branch**

```bash
git checkout -b dev_feature_5
```

Expected: `Switched to a new branch 'dev_feature_5'`. No commit yet.

---

### Task 1: Transcription config resolution

**Files:**
- Modify: `backend/aiproxy/config.py` (append a new section at the end)
- Test: `backend/tests/test_aiproxy_transcription_config.py` (new)

**Interfaces:**
- Produces: `TranscriptionConfig` dataclass (fields `provider: str`, `model: str`, `api_key: str`, `base_url: str`) and `get_transcription_config() -> TranscriptionConfig` in `aiproxy.config`. Task 7's router and Task 8's `main.py` consume these.
- Note: does **not** reuse `_normalize_provider` — that maps `"local"` → `"ollama"`, which is wrong here (`local` = faster-whisper).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_aiproxy_transcription_config.py`:

```python
"""Unit tests for aiproxy.config transcription resolution.

No network access, no API keys required.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from aiproxy import config

_ALL_VARS = (
    "TRANSCRIPTION_PROVIDER",
    "GROQ_API_KEY", "GROQ_STT_MODEL", "GROQ_BASE_URL",
    "OPENAI_API_KEY", "OPENAI_STT_MODEL", "OPENAI_BASE_URL",
    "DEEPGRAM_API_KEY", "DEEPGRAM_STT_MODEL", "DEEPGRAM_BASE_URL",
    "ELEVENLABS_API_KEY", "ELEVENLABS_STT_MODEL", "ELEVENLABS_BASE_URL",
    "WHISPER_MODEL", "FAKE_ANALYSIS",
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in _ALL_VARS:
        monkeypatch.delenv(name, raising=False)


class TestDefaults:
    def test_default_is_local(self):
        cfg = config.get_transcription_config()
        assert cfg.provider == "local"
        assert cfg.model == "base"          # WHISPER_MODEL default
        assert cfg.api_key == ""
        assert cfg.base_url == ""

    def test_local_model_from_whisper_model_env(self, monkeypatch):
        monkeypatch.setenv("WHISPER_MODEL", "small")
        assert config.get_transcription_config().model == "small"


class TestAliases:
    @pytest.mark.parametrize("alias", ["whisper", "faster-whisper", "faster_whisper", "LOCAL"])
    def test_local_aliases(self, monkeypatch, alias):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", alias)
        assert config.get_transcription_config().provider == "local"


class TestGroq:
    def test_groq_defaults(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "groq")
        monkeypatch.setenv("GROQ_API_KEY", "gk-test")
        cfg = config.get_transcription_config()
        assert cfg.provider == "groq"
        assert cfg.model == "whisper-large-v3-turbo"
        assert cfg.api_key == "gk-test"
        assert cfg.base_url == "https://api.groq.com/openai/v1"

    def test_groq_model_override(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "groq")
        monkeypatch.setenv("GROQ_STT_MODEL", "whisper-large-v3")
        assert config.get_transcription_config().model == "whisper-large-v3"


class TestOpenAI:
    def test_openai_defaults(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        cfg = config.get_transcription_config()
        assert cfg.provider == "openai"
        assert cfg.model == "whisper-1"
        assert cfg.api_key == "sk-test"
        assert cfg.base_url == "https://api.openai.com/v1"


class TestDeepgram:
    def test_deepgram_defaults(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "deepgram")
        monkeypatch.setenv("DEEPGRAM_API_KEY", "dg-test")
        cfg = config.get_transcription_config()
        assert cfg.provider == "deepgram"
        assert cfg.model == "nova-3"
        assert cfg.api_key == "dg-test"
        assert cfg.base_url == "https://api.deepgram.com"


class TestElevenLabs:
    def test_elevenlabs_defaults(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "elevenlabs")
        monkeypatch.setenv("ELEVENLABS_API_KEY", "el-test")
        cfg = config.get_transcription_config()
        assert cfg.provider == "elevenlabs"
        assert cfg.model == "scribe_v1"
        assert cfg.api_key == "el-test"
        assert cfg.base_url == "https://api.elevenlabs.io"


class TestMockAndFake:
    def test_mock_explicit(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "mock")
        assert config.get_transcription_config().provider == "mock"

    def test_fake_analysis_does_not_touch_transcription(self, monkeypatch):
        monkeypatch.setenv("FAKE_ANALYSIS", "1")
        assert config.get_transcription_config().provider == "local"
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_config.py -v`
Expected: FAIL — `AttributeError: module 'aiproxy.config' has no attribute 'get_transcription_config'`

- [ ] **Step 3: Implement the config resolver**

Append to `backend/aiproxy/config.py` (after the rerank section):

```python
# ─────────────────────────────────────────────────────────────────────────────
# Transcription (speech-to-text) config
# ─────────────────────────────────────────────────────────────────────────────

# NOTE: deliberately does NOT use _normalize_provider — there, "local" means
# ollama. For transcription, "local" means the in-process faster-whisper
# service. Transcription is also independent of FAKE_ANALYSIS: live
# transcripts keep working in fake mode; mock only via TRANSCRIPTION_PROVIDER.

_TRANSCRIPTION_ALIASES = {
    "whisper": "local",
    "faster-whisper": "local",
    "faster_whisper": "local",
}


@dataclass(frozen=True)
class TranscriptionConfig:
    provider: str
    model: str
    api_key: str
    base_url: str


def get_transcription_config() -> TranscriptionConfig:
    raw = _first_non_empty("TRANSCRIPTION_PROVIDER", default="local").lower()
    provider = _TRANSCRIPTION_ALIASES.get(raw, raw)

    if provider == "groq":
        return TranscriptionConfig(
            provider="groq",
            model=_first_non_empty("GROQ_STT_MODEL", default="whisper-large-v3-turbo"),
            api_key=_first_non_empty("GROQ_API_KEY"),
            base_url=_first_non_empty("GROQ_BASE_URL", default="https://api.groq.com/openai/v1"),
        )
    if provider == "openai":
        return TranscriptionConfig(
            provider="openai",
            model=_first_non_empty("OPENAI_STT_MODEL", default="whisper-1"),
            api_key=_first_non_empty("OPENAI_API_KEY"),
            base_url=_first_non_empty("OPENAI_BASE_URL", default="https://api.openai.com/v1"),
        )
    if provider == "deepgram":
        return TranscriptionConfig(
            provider="deepgram",
            model=_first_non_empty("DEEPGRAM_STT_MODEL", default="nova-3"),
            api_key=_first_non_empty("DEEPGRAM_API_KEY"),
            base_url=_first_non_empty("DEEPGRAM_BASE_URL", default="https://api.deepgram.com"),
        )
    if provider == "elevenlabs":
        return TranscriptionConfig(
            provider="elevenlabs",
            model=_first_non_empty("ELEVENLABS_STT_MODEL", default="scribe_v1"),
            api_key=_first_non_empty("ELEVENLABS_API_KEY"),
            base_url=_first_non_empty("ELEVENLABS_BASE_URL", default="https://api.elevenlabs.io"),
        )
    if provider == "mock":
        return TranscriptionConfig(provider="mock", model="mock", api_key="", base_url="")

    # "local" falls through here; unrecognized names pass through unchanged
    # and the router raises "Unsupported transcription provider" for them.
    return TranscriptionConfig(
        provider=provider,
        model=_first_non_empty("WHISPER_MODEL", default="base"),
        api_key="",
        base_url="",
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_config.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/aiproxy/config.py backend/tests/test_aiproxy_transcription_config.py
git commit -m "feat(aiproxy): transcription provider config resolution"
```

---

### Task 2: STT output cleaning module (hallucination filter moves into aiproxy)

**Files:**
- Create: `backend/aiproxy/sttclean.py`
- Modify: `backend/services/transcription.py` (delete the private filter helpers, import from aiproxy)
- Test: `backend/tests/test_aiproxy_sttclean.py` (new)

**Interfaces:**
- Produces: `is_hallucination(text: str) -> bool` in `aiproxy.sttclean`. Task 7's facade and `services/transcription.py` consume it.
- Rationale: Whisper-family hallucination filtering ("Sous-titres réalisés par…", repetition loops) applies to **API** Whisper output (Groq) exactly as to local output, so it must live above the provider layer.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_aiproxy_sttclean.py`:

```python
"""Unit tests for aiproxy.sttclean — Whisper hallucination/garbage filtering."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aiproxy.sttclean import is_hallucination


class TestHallucinations:
    def test_empty_is_hallucination(self):
        assert is_hallucination("") is True
        assert is_hallucination("   ") is True

    def test_known_substrings(self):
        assert is_hallucination("Sous-titres réalisés par la communauté Amara") is True
        assert is_hallucination("Thanks for watching!") is True

    def test_repetition_loop(self):
        assert is_hallucination("je cours je cours je cours je cours") is True

    def test_trivial_punctuation(self):
        assert is_hallucination("...") is True

    def test_real_speech_passes(self):
        assert is_hallucination("Bonjour, je m'appelle Yassine et je suis développeur.") is False

    def test_short_valid_answers_pass(self):
        assert is_hallucination("Oui.") is False
        assert is_hallucination("Merci beaucoup.") is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_sttclean.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'aiproxy.sttclean'`

- [ ] **Step 3: Create `backend/aiproxy/sttclean.py`**

Move the filter block from `services/transcription.py` **verbatim** (lines 25–121: `_HALLUCINATION_SUBSTRINGS`, `_TRIVIAL_SHORT`, `_PUNCT_STRIP`, `_normalize_words`, `_has_repetition_loop`, `_is_hallucination`) into the new module, renaming `_is_hallucination` → `is_hallucination` (public):

```python
"""Whisper-family STT output cleaning.

Hallucination and garbage filtering shared by ALL transcription providers
(local faster-whisper and API Whisper hosts hallucinate the same phrases on
silence/noise chunks). Applied centrally by ``aiproxy.transcribe``.

Moved from ``services/transcription.py`` — same heuristics, now provider-agnostic.
"""

# Hallucinations Whisper commonly emits on pure-silence / music / noise chunks.
# Substring match — covers conjugations and partial bleeds.
_HALLUCINATION_SUBSTRINGS = (
    "sous-titres réalisés par la communauté amara",
    "sous-titrage st' 501",
    "sous-titrage société radio-canada",
    "merci d'avoir regardé",
    "thanks for watching",
    "thank you for watching",
    "abonnez-vous",
    "like and subscribe",
    "♪",
    "st' 501",
    "humain.com",
    "tous droits réservés",
    "copyright",
    "mediatranslate",
    "vostfr",
    "retranscription par",
)

# Only patterns that are NEVER real speech — not short words people actually say.
_TRIVIAL_SHORT = {
    "...", ".", "..", "—", "…", "???", "!!!",
}

_PUNCT_STRIP = ".,;:!?\"'()[]{}«»…"


def _normalize_words(text: str) -> list:
    return [w.strip(_PUNCT_STRIP) for w in text.lower().split() if w.strip(_PUNCT_STRIP)]


def _has_repetition_loop(text: str) -> bool:
    """Detect Whisper's classic 'I am running, I am running, I am running' loop."""
    words = _normalize_words(text)
    n = len(words)
    if n < 4:
        if n >= 3 and len(set(words)) == 1:
            return True
        return False

    for size in (1, 2, 3, 4, 5):
        if n < size * 3:
            continue
        for i in range(n - size * 3 + 1):
            phrase = words[i : i + size]
            if (
                words[i + size : i + size * 2] == phrase
                and words[i + size * 2 : i + size * 3] == phrase
            ):
                return True

    if n >= 6:
        uniq = len(set(words))
        if uniq / n < 0.4:
            return True

    return False


def is_hallucination(text: str) -> bool:
    t = text.strip().lower()
    if not t:
        return True

    if len(t) > 3 and len(set(t)) <= 2 and not any(c.isalnum() for c in t):
        return True

    stripped = t.strip(_PUNCT_STRIP).strip()
    if not stripped:
        return True
    if stripped in _TRIVIAL_SHORT or stripped.rstrip(".!?,") in _TRIVIAL_SHORT:
        return True
    for needle in _HALLUCINATION_SUBSTRINGS:
        if needle in t:
            return True
    if _has_repetition_loop(t):
        return True

    words = _normalize_words(t)
    if len(words) > 5 and len(set("".join(words))) < 4:
        return True

    return False
```

(Copy the exact body from `services/transcription.py` — the code above IS that body; if the file differs, the file wins.)

- [ ] **Step 4: Update `backend/services/transcription.py`**

Delete the moved block (constants + `_normalize_words` + `_has_repetition_loop` + `_is_hallucination`, lines 25–121) and replace the one call site. In one Edit, add the import **and** its usage:

```python
from faster_whisper import WhisperModel

from aiproxy.sttclean import is_hallucination
```

and at the end of `_run` (was line 253):

```python
        if is_hallucination(text):
            print(f"[Whisper] dropped hallucination: {text!r}")
            return ""
        return text
```

- [ ] **Step 5: Run tests + existing suite to verify nothing broke**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_sttclean.py tests\test_aiproxy_config.py -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/aiproxy/sttclean.py backend/services/transcription.py backend/tests/test_aiproxy_sttclean.py
git commit -m "refactor(aiproxy): move STT hallucination filter into aiproxy.sttclean"
```

---

### Task 3: OpenAI-compatible transcription provider (covers Groq + OpenAI)

**Files:**
- Modify: `backend/aiproxy/providers/openai.py` (add `transcribe` method)
- Modify: `backend/aiproxy/providers/base.py` (add `TranscriptionProvider` protocol)
- Test: `backend/tests/test_aiproxy_transcription_providers.py` (new)

**Interfaces:**
- Produces: `OpenAIProvider.transcribe(audio: bytes, *, model: str, language: str | None = None, api_key: str = "", base_url: str = "https://api.openai.com/v1", capability: str = "transcription") -> str`. Task 7's router calls this for both `groq` and `openai` (different `base_url`/`api_key`).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_aiproxy_transcription_providers.py`:

```python
"""Request/response shape tests for aiproxy transcription providers.

Mocks httpx.AsyncClient.post (same approach as test_aiproxy_providers.py).
No network access, no real API keys.
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
import pytest

from aiproxy.errors import ProviderError
from aiproxy.providers.openai import OpenAIProvider


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)
        self.request = httpx.Request("POST", "https://example.test/")

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=self.request, response=self)


def _patch_post(monkeypatch, capture, response_payload, status_code=200):
    async def fake_post(self, url, **kwargs):
        capture["url"] = url
        capture.update(kwargs)
        return _FakeResponse(status_code, response_payload)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)


# ─────────────────────────────────────────────────────────────────────────────
# OpenAI-compatible (OpenAI + Groq)
# ─────────────────────────────────────────────────────────────────────────────

def test_openai_compatible_transcribe_request_and_parsing(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"text": " Bonjour tout le monde. "})

    provider = OpenAIProvider()
    result = asyncio.run(
        provider.transcribe(
            b"RIFFfakewav",
            model="whisper-large-v3-turbo",
            language="fr",
            api_key="gk-test",
            base_url="https://api.groq.com/openai/v1",
        )
    )

    assert result == "Bonjour tout le monde."
    assert capture["url"] == "https://api.groq.com/openai/v1/audio/transcriptions"
    assert capture["headers"]["Authorization"] == "Bearer gk-test"
    assert capture["files"]["file"] == ("audio.wav", b"RIFFfakewav", "audio/wav")
    assert capture["data"]["model"] == "whisper-large-v3-turbo"
    assert capture["data"]["language"] == "fr"
    assert capture["data"]["response_format"] == "json"


def test_openai_compatible_transcribe_omits_language_when_none(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"text": "hello"})

    provider = OpenAIProvider()
    asyncio.run(provider.transcribe(b"x", model="whisper-1", api_key="sk-test"))

    assert "language" not in capture["data"]
    assert capture["url"] == "https://api.openai.com/v1/audio/transcriptions"


def test_openai_compatible_transcribe_missing_key_raises(monkeypatch):
    provider = OpenAIProvider()
    with pytest.raises(ProviderError):
        asyncio.run(provider.transcribe(b"x", model="whisper-1", api_key=""))


def test_openai_compatible_transcribe_http_error_raises(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"error": "rate limit"}, status_code=429)

    provider = OpenAIProvider()
    with pytest.raises(ProviderError):
        asyncio.run(provider.transcribe(b"x", model="whisper-1", api_key="sk-test"))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_providers.py -v`
Expected: FAIL — `AttributeError: 'OpenAIProvider' object has no attribute 'transcribe'`

- [ ] **Step 3: Implement**

In `backend/aiproxy/providers/base.py`, append:

```python
class TranscriptionProvider(Protocol):
    async def transcribe(
        self,
        audio: bytes,
        *,
        model: str,
        language: str | None,
    ) -> str:
        ...
```

In `backend/aiproxy/providers/openai.py`, update the module docstring first line to `"""OpenAI provider — chat + transcription (OpenAI-compatible hosts, e.g. Groq)."""` and add to `OpenAIProvider`:

```python
    async def transcribe(
        self,
        audio: bytes,
        *,
        model: str,
        language: str | None = None,
        api_key: str = "",
        base_url: str = "https://api.openai.com/v1",
        capability: str = "transcription",
    ) -> str:
        """POST /audio/transcriptions on any OpenAI-compatible host (OpenAI, Groq)."""
        if not api_key:
            raise ProviderError("openai-compatible", capability, "API key is missing.")

        data: dict[str, Any] = {"model": model, "response_format": "json", "temperature": "0"}
        if language:
            data["language"] = language

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{base_url.rstrip('/')}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": ("audio.wav", audio, "audio/wav")},
                    data=data,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise ProviderError("openai-compatible", capability, str(exc)) from exc
            payload = response.json()

        return (payload.get("text") or "").strip()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_providers.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/aiproxy/providers/openai.py backend/aiproxy/providers/base.py backend/tests/test_aiproxy_transcription_providers.py
git commit -m "feat(aiproxy): OpenAI-compatible transcription provider (OpenAI + Groq)"
```

---

### Task 4: Deepgram provider

**Files:**
- Create: `backend/aiproxy/providers/deepgram.py`
- Test: append to `backend/tests/test_aiproxy_transcription_providers.py`

**Interfaces:**
- Produces: `DeepgramProvider.transcribe(audio: bytes, *, model: str, language: str | None = None, api_key: str = "", base_url: str = "https://api.deepgram.com", capability: str = "transcription") -> str`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_aiproxy_transcription_providers.py`:

```python
# ─────────────────────────────────────────────────────────────────────────────
# Deepgram
# ─────────────────────────────────────────────────────────────────────────────

from aiproxy.providers.deepgram import DeepgramProvider


def test_deepgram_transcribe_request_and_parsing(monkeypatch):
    capture = {}
    canned = {
        "results": {
            "channels": [
                {"alternatives": [{"transcript": "Bonjour à tous.", "confidence": 0.98}]}
            ]
        }
    }
    _patch_post(monkeypatch, capture, canned)

    provider = DeepgramProvider()
    result = asyncio.run(
        provider.transcribe(b"RIFFfakewav", model="nova-3", language="fr", api_key="dg-test")
    )

    assert result == "Bonjour à tous."
    assert capture["url"] == "https://api.deepgram.com/v1/listen"
    assert capture["headers"]["Authorization"] == "Token dg-test"
    assert capture["headers"]["Content-Type"] == "audio/wav"
    assert capture["params"]["model"] == "nova-3"
    assert capture["params"]["language"] == "fr"
    assert capture["params"]["smart_format"] == "true"
    assert capture["content"] == b"RIFFfakewav"


def test_deepgram_transcribe_empty_results_returns_empty(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"results": {"channels": []}})

    provider = DeepgramProvider()
    result = asyncio.run(provider.transcribe(b"x", model="nova-3", api_key="dg-test"))
    assert result == ""


def test_deepgram_missing_key_raises():
    provider = DeepgramProvider()
    with pytest.raises(ProviderError):
        asyncio.run(provider.transcribe(b"x", model="nova-3", api_key=""))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_providers.py -v -k deepgram`
Expected: FAIL — `ModuleNotFoundError: No module named 'aiproxy.providers.deepgram'`

- [ ] **Step 3: Create `backend/aiproxy/providers/deepgram.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_providers.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/aiproxy/providers/deepgram.py backend/tests/test_aiproxy_transcription_providers.py
git commit -m "feat(aiproxy): Deepgram transcription provider"
```

---

### Task 5: ElevenLabs provider

**Files:**
- Create: `backend/aiproxy/providers/elevenlabs.py`
- Test: append to `backend/tests/test_aiproxy_transcription_providers.py`

**Interfaces:**
- Produces: `ElevenLabsProvider.transcribe(audio: bytes, *, model: str, language: str | None = None, api_key: str = "", base_url: str = "https://api.elevenlabs.io", capability: str = "transcription") -> str`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_aiproxy_transcription_providers.py`:

```python
# ─────────────────────────────────────────────────────────────────────────────
# ElevenLabs
# ─────────────────────────────────────────────────────────────────────────────

from aiproxy.providers.elevenlabs import ElevenLabsProvider


def test_elevenlabs_transcribe_request_and_parsing(monkeypatch):
    capture = {}
    _patch_post(monkeypatch, capture, {"language_code": "fr", "text": "Bonjour et bienvenue."})

    provider = ElevenLabsProvider()
    result = asyncio.run(
        provider.transcribe(b"RIFFfakewav", model="scribe_v1", language="fr", api_key="el-test")
    )

    assert result == "Bonjour et bienvenue."
    assert capture["url"] == "https://api.elevenlabs.io/v1/speech-to-text"
    assert capture["headers"]["xi-api-key"] == "el-test"
    assert capture["files"]["file"] == ("audio.wav", b"RIFFfakewav", "audio/wav")
    assert capture["data"]["model_id"] == "scribe_v1"
    assert capture["data"]["language_code"] == "fr"


def test_elevenlabs_missing_key_raises():
    provider = ElevenLabsProvider()
    with pytest.raises(ProviderError):
        asyncio.run(provider.transcribe(b"x", model="scribe_v1", api_key=""))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_providers.py -v -k elevenlabs`
Expected: FAIL — `ModuleNotFoundError: No module named 'aiproxy.providers.elevenlabs'`

- [ ] **Step 3: Create `backend/aiproxy/providers/elevenlabs.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_providers.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/aiproxy/providers/elevenlabs.py backend/tests/test_aiproxy_transcription_providers.py
git commit -m "feat(aiproxy): ElevenLabs Scribe transcription provider"
```

---

### Task 6: Local (faster-whisper) and mock transcription providers

**Files:**
- Create: `backend/aiproxy/providers/local_whisper.py`
- Modify: `backend/aiproxy/providers/mock.py` (add `transcribe`)
- Test: append to `backend/tests/test_aiproxy_transcription_providers.py`

**Interfaces:**
- Produces: `LocalWhisperProvider.transcribe(audio, *, model="", language=None, capability="transcription", **_) -> str` (delegates to `services.transcription.get_whisper_service()`, **lazy import inside the method** so API-only deploys never import faster-whisper/torch); `MockProvider.transcribe(...) -> "[MOCK] transcription de test."`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_aiproxy_transcription_providers.py`:

```python
# ─────────────────────────────────────────────────────────────────────────────
# Local (faster-whisper) + mock
# ─────────────────────────────────────────────────────────────────────────────

from aiproxy.providers.local_whisper import LocalWhisperProvider
from aiproxy.providers.mock import MockProvider


def test_local_whisper_delegates_to_service(monkeypatch):
    class _FakeService:
        async def transcribe(self, wav_bytes, language=None):
            assert wav_bytes == b"RIFFfakewav"
            assert language == "fr"
            return "transcription locale"

    import services.transcription as st
    monkeypatch.setattr(st, "get_whisper_service", lambda: _FakeService())

    provider = LocalWhisperProvider()
    result = asyncio.run(provider.transcribe(b"RIFFfakewav", model="base", language="fr"))
    assert result == "transcription locale"


def test_mock_transcribe_is_deterministic():
    provider = MockProvider()
    result = asyncio.run(provider.transcribe(b"anything", model="mock", language=None))
    assert result == "[MOCK] transcription de test."
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_providers.py -v -k "local or mock"`
Expected: FAIL — `ModuleNotFoundError: No module named 'aiproxy.providers.local_whisper'`

- [ ] **Step 3: Implement**

Create `backend/aiproxy/providers/local_whisper.py`:

```python
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
```

In `backend/aiproxy/providers/mock.py`, add to `MockProvider` (and mention `transcribe` in the module docstring list):

```python
    async def transcribe(
        self,
        audio: bytes,
        *,
        model: str = "mock",
        language: str | None = None,
    ) -> str:
        return "[MOCK] transcription de test."
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcription_providers.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/aiproxy/providers/local_whisper.py backend/aiproxy/providers/mock.py backend/tests/test_aiproxy_transcription_providers.py
git commit -m "feat(aiproxy): local faster-whisper + mock transcription providers"
```

---

### Task 7: Router dispatch + `aiproxy.transcribe()` facade

**Files:**
- Modify: `backend/aiproxy/router.py`
- Modify: `backend/aiproxy/__init__.py`
- Test: `backend/tests/test_aiproxy_transcribe_facade.py` (new)

**Interfaces:**
- Produces: `aiproxy.transcribe(audio: bytes, *, language: str | None = None, capability: str = "transcription") -> str` — the ONLY function call sites use (Task 8). Applies `sttclean.is_hallucination` centrally: hallucinated output → `""`.
- Produces: `dispatch_transcribe(provider, model, audio, *, language, api_key, base_url, capability)` in `router.py`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_aiproxy_transcribe_facade.py`:

```python
"""Facade + dispatch tests for aiproxy.transcribe."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

import aiproxy
from aiproxy import router


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in ("TRANSCRIPTION_PROVIDER", "GROQ_API_KEY", "GROQ_STT_MODEL", "FAKE_ANALYSIS"):
        monkeypatch.delenv(name, raising=False)


def test_facade_mock_provider(monkeypatch):
    monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "mock")
    result = asyncio.run(aiproxy.transcribe(b"anything"))
    assert result == "[MOCK] transcription de test."


def test_facade_filters_hallucinations(monkeypatch):
    monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "gk-test")

    async def fake_dispatch(provider, model, audio, **kwargs):
        return "Merci d'avoir regardé !"

    monkeypatch.setattr("aiproxy.dispatch_transcribe", fake_dispatch)
    result = asyncio.run(aiproxy.transcribe(b"silence"))
    assert result == ""


def test_facade_passes_language_through(monkeypatch):
    monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "gk-test")
    captured = {}

    async def fake_dispatch(provider, model, audio, **kwargs):
        captured["provider"] = provider
        captured["model"] = model
        captured["language"] = kwargs.get("language")
        return "Bonjour."

    monkeypatch.setattr("aiproxy.dispatch_transcribe", fake_dispatch)
    result = asyncio.run(aiproxy.transcribe(b"wav", language="fr"))
    assert result == "Bonjour."
    assert captured == {"provider": "groq", "model": "whisper-large-v3-turbo", "language": "fr"}


def test_dispatch_unknown_provider_raises():
    with pytest.raises(ValueError):
        asyncio.run(
            router.dispatch_transcribe("nope", "m", b"x", language=None, api_key="", base_url="")
        )


def test_dispatch_routes_groq_to_openai_compatible(monkeypatch):
    captured = {}

    async def fake_transcribe(self, audio, **kwargs):
        captured.update(kwargs)
        return "ok"

    from aiproxy.providers.openai import OpenAIProvider
    monkeypatch.setattr(OpenAIProvider, "transcribe", fake_transcribe)

    result = asyncio.run(
        router.dispatch_transcribe(
            "groq", "whisper-large-v3-turbo", b"x",
            language="fr", api_key="gk", base_url="https://api.groq.com/openai/v1",
        )
    )
    assert result == "ok"
    assert captured["api_key"] == "gk"
    assert captured["base_url"] == "https://api.groq.com/openai/v1"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `venv\Scripts\python.exe -m pytest tests\test_aiproxy_transcribe_facade.py -v`
Expected: FAIL — `AttributeError: module 'aiproxy' has no attribute 'transcribe'`

- [ ] **Step 3: Implement router dispatch**

In `backend/aiproxy/router.py` — add imports + instances (top of file, next to existing ones):

```python
from aiproxy.providers.deepgram import DeepgramProvider
from aiproxy.providers.elevenlabs import ElevenLabsProvider
from aiproxy.providers.local_whisper import LocalWhisperProvider
```

```python
_deepgram = DeepgramProvider()
_elevenlabs = ElevenLabsProvider()
_local_whisper = LocalWhisperProvider()

TRANSCRIPTION_PROVIDERS = {
    "groq": _openai,        # OpenAI-compatible endpoint
    "openai": _openai,
    "deepgram": _deepgram,
    "elevenlabs": _elevenlabs,
    "local": _local_whisper,
    "mock": _mock,
}
```

And the dispatch function at the end of the file:

```python
async def dispatch_transcribe(
    provider: str,
    model: str,
    audio: bytes,
    *,
    language: str | None = None,
    api_key: str = "",
    base_url: str = "",
    capability: str = "transcription",
) -> str:
    logger.info("aiproxy: %s -> %s (model=%s)", capability, provider, model)

    impl = TRANSCRIPTION_PROVIDERS.get(provider)
    if impl is None:
        raise ValueError(f"Unsupported transcription provider: {provider}")

    if provider in ("groq", "openai"):
        return await impl.transcribe(
            audio, model=model, language=language,
            api_key=api_key, base_url=base_url, capability=capability,
        )
    if provider == "deepgram":
        return await impl.transcribe(
            audio, model=model, language=language,
            api_key=api_key, base_url=base_url, capability=capability,
        )
    if provider == "elevenlabs":
        return await impl.transcribe(
            audio, model=model, language=language,
            api_key=api_key, base_url=base_url, capability=capability,
        )
    if provider == "local":
        return await impl.transcribe(audio, model=model, language=language, capability=capability)
    if provider == "mock":
        return await impl.transcribe(audio, model=model, language=language)

    raise ValueError(f"Unsupported transcription provider: {provider}")
```

- [ ] **Step 4: Implement facade**

In `backend/aiproxy/__init__.py`:
- Update the docstring's capability list to `(``embed``, ``chat``, ``rerank``, ``transcribe``)`.
- Extend the router import line and `__all__`:

```python
from aiproxy.router import (
    dispatch_chat,
    dispatch_embed,
    dispatch_rerank,
    dispatch_transcribe,
    mock_provider,
)
from aiproxy.sttclean import is_hallucination
```

```python
__all__ = [
    "embed",
    "embed_sync",
    "chat",
    "chat_sync",
    "rerank",
    "transcribe",
    "AIProxyError",
    "ConfigError",
    "ProviderError",
]
```

- Add the facade function (after `rerank`):

```python
async def transcribe(
    audio: bytes,
    *,
    language: str | None = None,
    capability: str = "transcription",
) -> str:
    """Transcribe a short audio clip (WAV bytes) to text.

    Provider/model resolve from ``TRANSCRIPTION_PROVIDER`` & friends (see
    ``config.get_transcription_config``). Whisper-style hallucinations are
    filtered centrally for every provider — hallucinated output returns ``""``.

    Unlike embeddings, transcription ignores ``FAKE_ANALYSIS`` (live
    transcripts keep working in fake-analysis demos); use
    ``TRANSCRIPTION_PROVIDER=mock`` for a fully canned transcript.
    """
    cfg = config.get_transcription_config()
    text = await dispatch_transcribe(
        cfg.provider,
        cfg.model,
        audio,
        language=language,
        api_key=cfg.api_key,
        base_url=cfg.base_url,
        capability=capability,
    )
    if not text:
        return ""
    if is_hallucination(text):
        return ""
    return text
```

> Note: the facade tests monkeypatch `aiproxy.dispatch_transcribe`, which works because the facade calls the name imported into the `aiproxy` package namespace.

- [ ] **Step 5: Run the full aiproxy suite**

Run: `venv\Scripts\python.exe -m pytest tests\ -v -k aiproxy`
Expected: all PASS (old embed/chat/rerank tests included)

- [ ] **Step 6: Commit**

```bash
git add backend/aiproxy/router.py backend/aiproxy/__init__.py backend/tests/test_aiproxy_transcribe_facade.py
git commit -m "feat(aiproxy): transcribe capability — router dispatch + facade with central hallucination filter"
```

---

### Task 8: Swap call sites + conditional startup load

**Files:**
- Modify: `backend/routers/interviews.py` (`/transcribe-test` ~line 1064, `/{interview_id}/transcribe` ~line 1095, import at line 23)
- Modify: `backend/main.py` (whisper eager-load block, lines 93–105; import at line 19)

**Interfaces:**
- Consumes: `aiproxy.transcribe(audio_bytes, language=...)` (Task 7), `aiproxy.config.get_transcription_config()` (Task 1), `aiproxy.AIProxyError`.

- [ ] **Step 1: Rewrite the two endpoints in `backend/routers/interviews.py`**

Replace the import `from services.transcription import get_whisper_service` (line 23) with `import aiproxy` **in the same Edit as one usage below** (edit-hook constraint).

`/transcribe-test` becomes:

```python
@router.post("/transcribe-test")
async def transcribe_test(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    audio_bytes = await audio.read()
    if not audio_bytes:
        return {"text": ""}

    try:
        text = await aiproxy.transcribe(audio_bytes, language=language)
    except aiproxy.AIProxyError as e:
        # Diagnostic endpoint: surface config/provider problems loudly.
        raise HTTPException(status_code=503, detail=f"Transcription unavailable: {e}")
    except Exception as e:
        print(f"[Transcription/test] error: {e}")
        return {"text": ""}

    return {"text": text or ""}
```

`/{interview_id}/transcribe`: keep the ObjectId check and the Mongo persistence exactly as-is; replace only the whisper block (lines 1111–1123) with:

```python
    try:
        text = await aiproxy.transcribe(audio_bytes, language=language)
    except Exception as e:
        # Live-interview path: never fail the call — drop the utterance instead.
        print(f"[Transcription] provider error: {e}")
        return {"text": "", "msg_id": msg_id}
```

- [ ] **Step 2: Make the startup load conditional in `backend/main.py`**

Replace the block at lines 93–105 (keep `from services.transcription import get_whisper_service` at line 19 — still used inside the branch):

```python
    # 3. Transcription — local model only when TRANSCRIPTION_PROVIDER=local
    from aiproxy.config import get_transcription_config
    stt_cfg = get_transcription_config()
    if stt_cfg.provider == "local":
        print("--- Loading transcription model (faster-whisper) ---")
        try:
            whisper = get_whisper_service()
            await asyncio.to_thread(whisper.load)
            print(
                f"[Whisper] READY (model={whisper.model_size}, "
                f"device={whisper.device}, compute={whisper.compute_type})"
            )
        except Exception as e:
            print(f"[Whisper] FAILED to load: {e}")
            print("[Whisper] Transcription endpoint will return 503 until fixed.")
    else:
        print(f"[Transcription] API provider '{stt_cfg.provider}' (model={stt_cfg.model}) — no local model load")
    print("------------------------------------------\n")
```

- [ ] **Step 3: Run the backend test suite**

Run: `venv\Scripts\python.exe -m pytest tests\ -v`
Expected: all PASS

- [ ] **Step 4: Manual smoke test (config-only check)**

Run: `venv\Scripts\python.exe -c "import aiproxy; print('import ok')"`
Expected: `import ok` (proves the aiproxy import chain stays torch-free — `local_whisper` only imports faster-whisper lazily at call time).

- [ ] **Step 5: Commit**

```bash
git add backend/routers/interviews.py backend/main.py
git commit -m "feat(interviews): transcription via aiproxy.transcribe; local model load only when provider=local"
```

---

### Task 9: Remove voice emotion — backend

**Files:**
- Modify: `backend/routers/interviews.py` (delete `/ai/ws/audio` endpoint lines 921–964, `AudioAnalyzer` import line 12, `import numpy as np` line 18, fix `_build_interview_emotion_history` ~line 1297)
- Delete: `backend/utils/interview_detection_ai/audio_analyzer.py`, `backend/utils/interview_detection_ai/model.py`

**Interfaces:**
- The `/ai/ws/analyze` face socket and `face_analyzer.py` are **NOT touched**.
- `_build_interview_emotion_history` keeps reading `audio_emotion` from **old** stored logs (backward compat for past interviews' reports) but stops emitting `voice:unknown` when absent.

- [ ] **Step 1: Delete the audio socket + imports in `interviews.py`**

Remove the whole `@router.websocket("/ai/ws/audio")` endpoint (lines 921–964), the line `from utils.interview_detection_ai.audio_analyzer import AudioAnalyzer` (line 12), and `import numpy as np` (line 18 — its only use was the audio socket, verified).

- [ ] **Step 2: Fix the emotion-history builder**

Replace the list comprehension in `_build_interview_emotion_history`:

```python
    return [
        {
            "timestamp": item.get("timestamp"),
            "emotions": [
                {"emotion": item.get("emotion", "neutral")},
                *(
                    [{"emotion": f"voice:{item['audio_emotion']}"}]
                    if item.get("audio_emotion")
                    else []
                ),
            ],
        }
        for item in interview.get("candidate_analysis_log", [])
    ]
```

- [ ] **Step 3: Delete the wav2vec2 files**

```bash
git rm backend/utils/interview_detection_ai/audio_analyzer.py backend/utils/interview_detection_ai/model.py
```

(`requirements.txt` unchanged — `transformers`/`torch` still used by `cv_parser.py` and the job-market CNN. `scipy` stays: check `grep -r "scipy" backend --include="*.py"` excluding venv first; if the audio analyzer was its only consumer, remove `scipy` from `requirements.txt` too.)

- [ ] **Step 4: Verify import health + run tests**

Run: `venv\Scripts\python.exe -c "import routers.interviews; print('ok')"` (from `backend/`)
Expected: `ok`
Run: `venv\Scripts\python.exe -m pytest tests\ -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(interviews)!: remove voice-emotion analysis (wav2vec2 + audio socket)"
```

---

### Task 10: Remove voice emotion — frontend

**Files:**
- Delete: `frontend/src/hooks/useAudioAnalyzer.js`
- Modify: `frontend/src/apps/Candidat/Interviews/InterviewRoom.jsx` (lines 13, 96, 156, 440–473)
- Modify: `frontend/src/apps/HR/applications/LiveInterview.jsx` (lines 134, 227, 233, 703–712, 1192–1199, 1233–1240, 1303)

- [ ] **Step 1: InterviewRoom.jsx**

Remove the `useAudioAnalyzer` import (line 13) and the hook call (line 156), the `lastAudioEmotionSentRef` declaration (line 96), and rewrite the emotion-send effect (lines ~437–473) without audio:

```jsx
    if (!hasJoined || isScreenSharing || analysis.status === 'no_face') return;

    const now = Date.now();
    const emotionChanged = analysis.dominant_emotion !== lastEmotionSentRef.current;
    const timeSinceLastSend = now - lastEmotionTimeRef.current;

    // Send on change or every 5s to keep HR panel fresh
    if (analysis.dominant_emotion && (emotionChanged || timeSinceLastSend >= 5000)) {
      sendData('emotion', {
        emotion: analysis.status === 'ok' ? analysis.dominant_emotion : 'neutral',
        attention_score: attentionScore,
        is_looking: analysis.is_looking_at_screen ?? false,
      });
      lastEmotionSentRef.current = analysis.dominant_emotion;
      lastEmotionTimeRef.current = now;
    }

    // Snapshot every 5s for the end-of-call log
    if (now - lastSnapshotTimeRef.current >= 5000) {
      analysisLogRef.current.push({
        timestamp:       now,
        emotion:         analysis.dominant_emotion,
        attention_score: attentionScore,
        is_looking:      analysis.is_looking_at_screen,
        yaw:             analysis.yaw,
        pitch:           analysis.pitch,
      });
      lastSnapshotTimeRef.current = now;
    }
  }, [analysis, attentionScore, hasJoined, isScreenSharing, sendData]);
```

- [ ] **Step 2: LiveInterview.jsx**

Remove every `audioEmotion` / `audio_emotion` reference (grep the file to catch them all):
- line 134: `const [audioEmotionStats, setAudioEmotionStats] = useState({});` → delete
- line 227: `audio_emotion: data.audio_emotion,` in the emotion-entry push → delete the field
- line 233: the `if (data.audio_emotion) setAudioEmotionStats(...)` line → delete
- lines 703–712 and 1233–1240: the two "voice emotion stats" panels (each wrapped in `{Object.keys(audioEmotionStats).length > 0 && (...)}`) → delete whole blocks
- lines 1192–1199: the live voice-emotion badge (`currentEmotionData?.audio_emotion && (...)`) → delete block
- line 1303: `{labelFor(entry.emotion)}{entry.audio_emotion ? ` · 🎙${labelFor(entry.audio_emotion)}` : ''}` → `{labelFor(entry.emotion)}`

- [ ] **Step 3: Delete the hook**

```bash
git rm frontend/src/hooks/useAudioAnalyzer.js
```

- [ ] **Step 4: Lint + build**

Run (from `frontend/`): `npm run lint` then `npm run build`
Expected: no errors (pre-existing warnings OK)

- [ ] **Step 5: Commit**

```bash
git add -A frontend
git commit -m "feat(frontend)!: remove voice-emotion UI (hook, badges, stats panels)"
```

---

### Task 11: Face analysis — browser engine (rules port + engine module + assets)

**Files:**
- Create: `frontend/src/services/faceAnalysis/emotionRules.js`
- Create: `frontend/src/services/faceAnalysis/browserEngine.js`
- Create: `frontend/public/models/face_landmarker.task` (copied from backend)
- Modify: `frontend/package.json` (+`@mediapipe/tasks-vision`, +`vite-plugin-static-copy` devDep)
- Modify: `frontend/vite.config.js` (static-copy of the WASM runtime)

**Interfaces:**
- Produces: `createBrowserEngine()` → `{ start({ webcamRef, onResult, onState }), stop() }`. `onResult` receives the **exact server payload shape**: `{frame_id, status: 'ok'|'no_face', is_looking_at_screen, dominant_emotion, yaw, pitch, overlay: {landmarks: [{x,y}], pose_line: {from,to}|null}}`. `onState` receives `'connecting' | 'connected' | 'unavailable'`.
- Thresholds are the backend's: looking ±5.5°, emotion score ≥ 0.20 (see `backend/utils/interview_detection_ai/face_analyzer.py:19-20`).

- [ ] **Step 1: Install deps + assets**

```bash
cd frontend
npm install @mediapipe/tasks-vision
npm install -D vite-plugin-static-copy
```

Copy the model (PowerShell, from repo root):

```powershell
New-Item -ItemType Directory -Force frontend\public\models
Copy-Item backend\utils\interview_detection_ai\models\face_landmarker.task frontend\public\models\face_landmarker.task
```

In `frontend/vite.config.js`, add the plugin (read the file first; add to the existing `plugins: [...]` array):

```js
import { viteStaticCopy } from 'vite-plugin-static-copy'
// inside plugins: [...]
viteStaticCopy({
  targets: [
    { src: 'node_modules/@mediapipe/tasks-vision/wasm/*', dest: 'mediapipe/wasm' },
  ],
}),
```

> The WASM runtime + model are self-hosted (no CDN) so the deployed demo has zero external asset dependencies. In dev, `viteStaticCopy` serves them at `/mediapipe/wasm`.

- [ ] **Step 2: Port the analysis rules — `frontend/src/services/faceAnalysis/emotionRules.js`**

Direct 1:1 port of `backend/utils/interview_detection_ai/face_analyzer.py` (same landmark indices, same thresholds, same rounding):

```js
/**
 * emotionRules — 1:1 port of backend/utils/interview_detection_ai/face_analyzer.py
 * (blendshape→emotion rules, iris-based head pose, overlay geometry).
 * Payload shape MUST stay identical to the server engine's WebSocket payload.
 */

export const LOOKING_THRESHOLD_DEGREES = 5.5;
export const EMOTION_THRESHOLD = 0.20;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round4 = (v) => Math.round(v * 10000) / 10000;
const makePoint = (x, y) => ({ x: round4(x), y: round4(y) });

const score = (b, name) => b[name] ?? 0;
const avg = (b, ...names) => names.reduce((s, n) => s + score(b, n), 0) / names.length;

export function pickDominantEmotion(blendshapes) {
  const scores = {
    joy:       avg(blendshapes, 'mouthSmileLeft', 'mouthSmileRight'),
    surprise:  avg(blendshapes, 'browInnerUp', 'jawOpen'),
    anger:     avg(blendshapes, 'browDownLeft', 'browDownRight', 'noseSneerLeft', 'noseSneerRight'),
    disgust:   avg(blendshapes, 'noseSneerLeft', 'noseSneerRight', 'mouthFrownLeft', 'mouthFrownRight'),
    fear:      avg(blendshapes, 'eyeWideLeft', 'eyeWideRight', 'browInnerUp'),
    sadness:   avg(blendshapes, 'mouthFrownLeft', 'mouthFrownRight', 'browInnerUp'),
    confusion: avg(blendshapes, 'browInnerUp', 'eyeSquintLeft', 'eyeSquintRight'),
  };
  let label = 'neutral';
  let best = -Infinity;
  for (const [name, value] of Object.entries(scores)) {
    if (value > best) { best = value; label = name; }
  }
  return best >= EMOTION_THRESHOLD ? label : 'neutral';
}

function irisGaze(iris, outer, inner, top, bottom) {
  const eyeW = Math.max(Math.abs(inner.x - outer.x), 1e-6);
  const eyeH = Math.max(Math.abs(bottom.y - top.y), 1e-6);
  const h = (iris.x - Math.min(outer.x, inner.x)) / eyeW - 0.5;
  const v = (iris.y - Math.min(top.y, bottom.y)) / eyeH - 0.5;
  return [h, v];
}

export function calculateHeadPose(landmarks) {
  const leftIris = landmarks[468];
  const rightIris = landmarks[473];
  const [lh, lv] = irisGaze(leftIris, landmarks[33], landmarks[133], landmarks[159], landmarks[145]);
  const [rh, rv] = irisGaze(rightIris, landmarks[362], landmarks[263], landmarks[386], landmarks[374]);
  return { yaw: ((lh + rh) / 2.0) * 90.0, pitch: ((lv + rv) / 2.0) * 90.0 };
}

export function buildOverlay(landmarks, yaw, pitch) {
  const leftIris = landmarks[468];
  const rightIris = landmarks[473];
  const midX = (leftIris.x + rightIris.x) / 2.0;
  const midY = (leftIris.y + rightIris.y) / 2.0;
  const yawOffset = Math.sin((yaw * Math.PI) / 180) * 0.12;
  const pitchOffset = Math.sin((pitch * Math.PI) / 180) * 0.08;
  return {
    landmarks: landmarks.map((p) => makePoint(p.x, p.y)),
    pose_line: {
      from: makePoint(midX, midY),
      to: makePoint(clamp(midX + yawOffset, 0.0, 1.0), clamp(midY - pitchOffset, 0.0, 1.0)),
    },
  };
}

export function noFacePayload(frameId) {
  return {
    frame_id: frameId,
    status: 'no_face',
    is_looking_at_screen: false,
    dominant_emotion: 'neutral',
    yaw: null,
    pitch: null,
    overlay: { landmarks: [], pose_line: null },
  };
}

export function analyzeResult(result, frameId) {
  const faces = result?.faceLandmarks;
  if (!faces || faces.length === 0) return noFacePayload(frameId);

  const landmarks = faces[0];
  const { yaw, pitch } = calculateHeadPose(landmarks);

  const blendshapes = {};
  for (const c of result.faceBlendshapes?.[0]?.categories ?? []) {
    blendshapes[c.categoryName] = c.score;
  }

  return {
    frame_id: frameId,
    status: 'ok',
    is_looking_at_screen:
      Math.abs(yaw) <= LOOKING_THRESHOLD_DEGREES && Math.abs(pitch) <= LOOKING_THRESHOLD_DEGREES,
    dominant_emotion: pickDominantEmotion(blendshapes),
    yaw: Math.round(yaw * 100) / 100,
    pitch: Math.round(pitch * 100) / 100,
    overlay: buildOverlay(landmarks, yaw, pitch),
  };
}
```

- [ ] **Step 3: The engine — `frontend/src/services/faceAnalysis/browserEngine.js`**

```js
/**
 * browserEngine — client-side face analysis with @mediapipe/tasks-vision.
 *
 * Same FaceLandmarker model as the backend engine, running in-browser
 * (WASM, self-hosted under /mediapipe/wasm + /models). Emits payloads with
 * the exact same shape as the server WebSocket engine at ~12 FPS.
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { analyzeResult } from './emotionRules';

const TARGET_FPS = 12;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export function createBrowserEngine() {
  let landmarker = null;
  let rafId = null;
  let disposed = false;
  let lastRunAt = 0;
  let lastVideoTime = -1;
  let frameId = 0;

  return {
    async start({ webcamRef, onResult, onState }) {
      onState('connecting');
      try {
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task' },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      } catch (err) {
        console.error('[faceAnalysis/browser] model load failed:', err);
        onState('unavailable');
        return;
      }
      if (disposed) { landmarker?.close(); landmarker = null; return; }
      onState('connected');

      const loop = (t) => {
        if (disposed) return;
        const video = webcamRef.current?.video;
        if (
          landmarker &&
          video && video.readyState === 4 &&
          t - lastRunAt >= FRAME_INTERVAL_MS &&
          video.currentTime !== lastVideoTime
        ) {
          lastRunAt = t;
          lastVideoTime = video.currentTime;
          frameId += 1;
          try {
            const result = landmarker.detectForVideo(video, performance.now());
            onResult(analyzeResult(result, frameId));
          } catch { /* skip frame */ }
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    },

    stop() {
      disposed = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      landmarker?.close();
      landmarker = null;
    },
  };
}
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint` then `npm run build`
Expected: no errors; `dist/mediapipe/wasm/` and `dist/models/face_landmarker.task` exist after build.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/public/models/face_landmarker.task frontend/src/services/faceAnalysis/
git commit -m "feat(frontend): browser face-analysis engine (mediapipe tasks-vision, self-hosted)"
```

---

### Task 12: Server engine extraction + engine switch in the hook

**Files:**
- Create: `frontend/src/services/faceAnalysis/serverEngine.js` (WS logic moved out of the hook)
- Create: `frontend/src/services/faceAnalysis/index.js`
- Rewrite: `frontend/src/hooks/useInterviewAnalysis.js` (same public API)

**Interfaces:**
- Consumes: `createBrowserEngine()` (Task 11).
- Produces: `createFaceAnalysisEngine(kind: 'browser'|'server')` → engine with `{start({webcamRef,onResult,onState}), stop()}`; hook keeps returning `{ analysis, connectionState }` so `InterviewRoom.jsx` needs **zero changes**.
- Engine selection: `import.meta.env.VITE_FACE_ANALYSIS_ENGINE`, default `'browser'`. The backend `/ai/ws/analyze` socket stays reachable with `VITE_FACE_ANALYSIS_ENGINE=server`.

- [ ] **Step 1: `frontend/src/services/faceAnalysis/serverEngine.js`**

The current WebSocket + frame-capture logic from `useInterviewAnalysis.js`, callback-ified (behavior identical — same URL resolution, token auth, reconnect backoff, 12 FPS capture, backpressure):

```js
/**
 * serverEngine — the original backend face analysis over WebSocket.
 *
 * Streams webcam JPEG frames to /api/interviews/ai/ws/analyze and relays
 * payloads back. Kept as a selectable engine (VITE_FACE_ANALYSIS_ENGINE=server);
 * the default engine runs in the browser (see browserEngine.js).
 */

import { getToken } from '../../core/apiClient';

const defaultWsUrl = () => {
  const apiBase = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
  return apiBase.replace(/^http/, 'ws') + '/api/interviews/ai/ws/analyze';
};

const WS_URL = import.meta.env.VITE_AI_WS_URL ?? defaultWsUrl();

const TARGET_FPS        = 12;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const SEND_TIMEOUT_MS   = 120;
const RECONNECT_DELAYS  = [1000, 2000, 5000];
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS.length;

export function createServerEngine() {
  let ws = null;
  let reconnectTimer = null;
  let rafId = null;
  let disposed = false;
  let reconnectCount = 0;
  let frameId = 0;
  let lastSentAt = 0;
  let lastTimestamp = 0;
  let inFlight = false;
  let inFlightStartedAt = 0;

  return {
    async start({ webcamRef, onResult, onState }) {
      const clearTimer = () => { clearTimeout(reconnectTimer); reconnectTimer = null; };

      const scheduleReconnect = () => {
        if (disposed) return;
        clearTimer();
        if (reconnectCount >= MAX_RECONNECT_ATTEMPTS) { onState('unavailable'); return; }
        const delay = RECONNECT_DELAYS[Math.min(reconnectCount, RECONNECT_DELAYS.length - 1)];
        reconnectCount += 1;
        onState('reconnecting');
        reconnectTimer = setTimeout(connect, delay);
      };

      const connect = () => {
        if (disposed) return;
        onState('connecting');
        const token = getToken();
        const socket = new WebSocket(`${WS_URL}${WS_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`);
        ws = socket;

        socket.onopen = () => {
          if (disposed) { socket.close(); return; }
          reconnectCount = 0;
          inFlight = false;
          onState('connected');
        };

        socket.onmessage = ({ data }) => {
          inFlight = false;
          try { onResult(JSON.parse(data)); } catch { /* ignore malformed */ }
        };

        socket.onerror = () => { /* onclose handles retry */ };

        socket.onclose = () => {
          ws = null;
          if (!disposed) { onState('disconnected'); scheduleReconnect(); }
        };
      };

      const captureFrame = (timestamp) => {
        if (disposed) return;
        const webcam = webcamRef.current;
        const ready = webcam?.video?.readyState === 4;

        if (
          ws?.readyState === WebSocket.OPEN &&
          ready &&
          timestamp - lastSentAt >= FRAME_INTERVAL_MS &&
          ws.bufferedAmount < 65536 &&
          (!inFlight || timestamp - inFlightStartedAt > SEND_TIMEOUT_MS)
        ) {
          const image = webcam.getScreenshot();
          if (image) {
            frameId += 1;
            const ts = Math.max(lastTimestamp + 1, Math.round(performance.now()));
            ws.send(JSON.stringify({ frame_id: frameId, timestamp_ms: ts, image }));
            lastSentAt = timestamp;
            lastTimestamp = ts;
            inFlight = true;
            inFlightStartedAt = timestamp;
          }
        }
        rafId = requestAnimationFrame(captureFrame);
      };

      connect();
      rafId = requestAnimationFrame(captureFrame);
    },

    stop() {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (ws) { ws.close(); ws = null; }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    },
  };
}
```

- [ ] **Step 2: `frontend/src/services/faceAnalysis/index.js`**

```js
/**
 * Face analysis engine selector — mirrors the backend aiproxy pattern:
 * swapping engines is a config change (VITE_FACE_ANALYSIS_ENGINE), never a
 * code change. 'browser' (default) runs mediapipe in-page; 'server' streams
 * frames to the original backend WebSocket.
 */

import { createBrowserEngine } from './browserEngine';
import { createServerEngine } from './serverEngine';

export const FACE_ANALYSIS_ENGINE =
  (import.meta.env.VITE_FACE_ANALYSIS_ENGINE || 'browser').toLowerCase();

export function createFaceAnalysisEngine(kind = FACE_ANALYSIS_ENGINE) {
  return kind === 'server' ? createServerEngine() : createBrowserEngine();
}
```

- [ ] **Step 3: Rewrite `frontend/src/hooks/useInterviewAnalysis.js`**

```js
/**
 * useInterviewAnalysis
 *
 * Real-time face landmark, head-pose, and emotion analysis for the interview
 * room. The engine is selected by VITE_FACE_ANALYSIS_ENGINE:
 *   - 'browser' (default): mediapipe tasks-vision in-page, no frame uploads
 *   - 'server':            original backend WebSocket engine
 *
 * @param {React.RefObject} webcamRef  - ref to the react-webcam instance
 * @param {boolean}         isActive   - start/stop the analysis
 * @returns {{ analysis, connectionState }}
 */

import { useEffect, useState } from 'react';
import { createFaceAnalysisEngine } from '../services/faceAnalysis';

export const EMPTY_ANALYSIS = {
  frame_id:            null,
  status:              'no_face',
  is_looking_at_screen: false,
  dominant_emotion:    'neutral',
  yaw:                 null,
  pitch:               null,
  overlay: {
    landmarks: [],
    pose_line: null,
  },
};

export function useInterviewAnalysis(webcamRef, isActive) {
  const [analysis,        setAnalysis]        = useState(EMPTY_ANALYSIS);
  const [connectionState, setConnectionState] = useState('disconnected');

  useEffect(() => {
    if (!isActive) {
      setAnalysis(EMPTY_ANALYSIS);
      setConnectionState('disconnected');
      return;
    }

    const engine = createFaceAnalysisEngine();
    engine.start({
      webcamRef,
      onResult: (payload) =>
        setAnalysis(prev => ({ ...prev, ...payload, overlay: payload.overlay ?? prev.overlay })),
      onState: setConnectionState,
    });

    return () => engine.stop();
  }, [isActive]); // webcamRef is stable – no need to include

  return { analysis, connectionState };
}
```

(`InterviewRoom.jsx` is untouched — same hook name, same return shape.)

- [ ] **Step 4: Lint + build + manual check**

Run: `npm run lint` then `npm run build` — expected: no errors.
Manual (dev): start backend + `npm run dev`, join an interview room as candidate → face overlay + emotion badge render; browser DevTools Network tab shows **no** WebSocket to `/ai/ws/analyze`. Then set `VITE_FACE_ANALYSIS_ENGINE=server` in `frontend/.env`, restart dev server, verify the old server path still works, then remove the var again.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/faceAnalysis/ frontend/src/hooks/useInterviewAnalysis.js
git commit -m "feat(frontend): swappable face-analysis engine (browser default, server preserved)"
```

---

### Task 13: Docs, graph refresh, final verification

**Files:**
- Modify: `backend/aiproxy/README.md`
- Modify: `graphify-out/graph.json` (via CLI)

- [ ] **Step 1: Update `backend/aiproxy/README.md`**

In "Use it", add after the rerank example:

```python
# Transcription (async). WAV bytes -> text. Hallucination-filtered centrally.
text = await aiproxy.transcribe(wav_bytes, language="fr")
```

In the config table, add the row:

```markdown
| Transcription | `TRANSCRIPTION_PROVIDER` (`local`) | `GROQ_STT_MODEL` (`whisper-large-v3-turbo`) · `OPENAI_STT_MODEL` (`whisper-1`) · `DEEPGRAM_STT_MODEL` (`nova-3`) · `ELEVENLABS_STT_MODEL` (`scribe_v1`) · `WHISPER_MODEL` (`base`, local) |
```

Under "Shared:", append `GROQ_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`. Add an example line: **"Transcription on Groq's free tier:** `TRANSCRIPTION_PROVIDER=groq` + `GROQ_API_KEY=...` (2,000 req/day free)". Update the Layout section provider list (`+ deepgram, elevenlabs, local_whisper`) and note transcription ignores `FAKE_ANALYSIS` (mock only via `TRANSCRIPTION_PROVIDER=mock`).

Also add a short "**Provider free tiers (July 2026)**" list: Groq 2,000 STT req/day free (no card) · Deepgram $200 signup credit, non-expiring (≈433 h nova-3) · ElevenLabs ~30 min/mo free · OpenAI paid-only.

- [ ] **Step 2: Rebuild the code graph**

Run (from repo root): `graphify update . --force`
(`--force` because modules were deleted — per CLAUDE.md.)

- [ ] **Step 3: Full verification**

- `venv\Scripts\python.exe -m pytest tests\ -v` (from `backend/`) — all PASS
- `npm run lint` and `npm run build` (from `frontend/`) — no errors
- End-to-end demo path (with a Groq key in `backend/.env`, `TRANSCRIPTION_PROVIDER=groq`): backend boots **without** the whisper load banner; the transcription test page returns text for a French clip; a full interview shows live transcript + browser face overlay; ending the interview produces the AI report with emotion timeline.

- [ ] **Step 4: Commit**

```bash
git add backend/aiproxy/README.md graphify-out/
git commit -m "docs(aiproxy): transcription capability + provider free-tier notes; rebuild code graph"
```

---

## Post-plan follow-ups (explicitly out of scope)

- Picking the demo's default provider (user decision: set `TRANSCRIPTION_PROVIDER` in the deploy env once keys exist).
- Streaming STT (word-by-word captions) — can be added later as another provider mode.
- Slimming torch/mediapipe out of the Docker image (blocked by the job-market CNN and the kept server face engine).
