# AI Proxy — provider-agnostic AI gateway

**Date:** 2026-07-02
**Branch:** `dev_feature_3`
**Status:** Approved (user waived formal review — "just start implementing")

## Goal

Introduce a single in-process gateway, `backend/aiproxy/`, that owns **every call to an
external AI API**. Application code stops talking to providers directly; instead it calls
capability functions (`embed`, `chat`, `rerank`) on the proxy, which routes each capability
to the configured provider client. Swapping a provider (e.g. Cohere → something else, or
HuggingFace → OpenAI) must be a **config change plus one new provider file**, never a
scattered code change.

Concretely, this change also adds **Cohere** as the default **embedding** and **rerank**
provider (new `COHERE_API_KEY`), and collapses the **three** duplicate embedding
implementations into one.

## Decisions (locked)

| Question | Decision |
|---|---|
| Proxy shape | **In-process Python package** (`backend/aiproxy/`). `/embedding`, `/llm` are *capability names*, not HTTP routes. No network hop. |
| Structure | **Approach A** — capability facade + typed provider registry (Protocol-based). Each provider is a small, isolated file. |
| Capabilities owned | **embedding, chat (llm), cv-parsing (via chat), rerank** — all four. |
| Embedding provider default | **cohere** (`embed-multilingual-v3.0`, 1024-dim). |
| Rerank provider | **cohere** (`rerank-v3.5`). |
| Chat / CV provider default | **huggingface** (unchanged). Cohere chat available but not default. |
| Rerank wiring | Built + wired into matching **behind `AI_MATCHING_RERANK` flag, default OFF** — matching behavior is unchanged until flipped. |
| Vector migration | **No backfill script.** New writes are 1024-dim; old 768-dim vectors stay stale until re-embedded naturally or via the existing `scripts/backfill_embeddings.py`. Consequences documented below. |

## Current state (what exists today)

- **Chat / LLM** — already centralized in `utils/llm_client.py::generate_chat_completion`,
  routing by `settings.provider` (huggingface / openai / ollama / mock). Config in
  `utils/ai_settings.py` (`LLMSettings`, per-capability resolvers). This is a mini-proxy already.
- **Embeddings** — three duplicate, hardcoded-to-Ollama impls:
  - `services/quiz/embeddings.py::generate_embedding` — async, Ollama `/api/embed`
    (payload `{"model","input"}`, response `{"embeddings":[[...]]}`).
  - `services/ai_matching.py::AIMatchingService.generate_embedding` — async method,
    Ollama `/api/embeddings` (payload `{"model","prompt","options"}`,
    response `{"embedding":[...]}`), plus `fake_analysis` random-768 path.
  - `routes/candidat/jobs.py::_generate_embedding_sync` — **sync** (`httpx.Client`),
    Ollama `/api/embeddings`, plus `fake_analysis` random-768 path.
- **CV parsing** — live path is `utils/account_analysis.py::parse_cv` (async), which
  **already** uses `generate_chat_completion`. The direct `huggingface_hub.InferenceClient`
  code in `utils/cv_parser.py` (`ResumeParser.generate_api` / `generate_local`) is used only
  by `utils/cv_parser.py::parse_cv`, which nothing in the live app imports (tests only).
- **Local, out of scope** — `services/transcription.py` (faster-whisper),
  `services/job_market_ai_service.py` (local CNN). No external API.

### Embedding call-site map (all must route through the proxy)

| File | Symbol | Sync/Async | input_type |
|---|---|---|---|
| `services/quiz/embeddings.py` | `generate_embedding`, `generate_embeddings_batch` | async | document (chunks) |
| `services/quiz/retrieval.py` | `generate_embedding(query_text)` @ ~L209 | async | **query** |
| `services/ai_matching.py` | `generate_embedding` @ L252 (profiles) / `find_top_candidates_for_job` @ L343 (job as query) | async | document / **query** |
| `routes/candidat/jobs.py` | `_generate_embedding_sync` @ L144, calls @ L321 (candidate), L419 (candidate) | **sync** | document |
| `routers/jobs.py` | `ai_svc.generate_embedding(job description)` @ L339, L385 | async | document |
| `routers/ai_matching.py` | `ai_service.generate_embedding(candidate_text)` @ L142 | async | document |
| `services/job_automation.py` | `ai_service.generate_embedding(...)` @ L181 (job desc), L205 (candidate) | async | document |
| `scripts/backfill_embeddings.py` | `ai_service.generate_embedding(...)` @ L31, L59 | async | document |

> Note the two different Ollama endpoints in use today (`/api/embed` vs `/api/embeddings`)
> and their different payload/response shapes. The proxy's Ollama provider must support
> the shape it actually calls; standardize on `/api/embeddings` (single-input) internally,
> keeping response parsing tolerant of both `{"embedding":[...]}` and `{"embeddings":[[...]]}`.

### Chat call-site map

| File | Via | Capability |
|---|---|---|
| `services/quiz/generation.py` @ ~L265 | `generate_chat_completion` | quiz_generation |
| `services/ai_matching.py` @ L72 | `generate_chat_completion` | profile_analysis / quiz_analysis |
| `utils/account_analysis.py` @ L99 | `generate_chat_completion` | account_analysis (this is the live CV parse) |
| `utils/interview_analyzer.py` @ L284 | `generate_chat_completion` | interview_analysis |
| `utils/cv_parser.py` `generate_api` @ L448 | `InferenceClient` **(direct — must be replaced)** | cv_parsing (legacy/tests) |

## Target architecture (Approach A)

```
backend/aiproxy/
  __init__.py        # public facade: embed / embed_sync, chat / chat_sync, rerank
  config.py          # capability -> {provider, model, keys, options} resolution
  router.py          # capability -> provider dispatch; mock/fake handling; typed errors
  errors.py          # AIProxyError, ProviderError, ConfigError
  providers/
    base.py          # Protocols: EmbeddingProvider, ChatProvider, RerankProvider
    cohere.py        # embed (v2 /embed), chat (v2 /chat), rerank (v2 /rerank) — httpx
    huggingface.py   # chat (router.huggingface.co) — moved from llm_client
    ollama.py        # embed + chat (local) — moved from llm_client + quiz/embeddings
    openai.py        # chat — moved from llm_client
    mock.py          # deterministic fakes; dimension-correct embeddings
```

### Public facade (the only surface app code uses)

```python
# async — for motor-based async services
async def embed(
    texts: str | list[str], *,
    input_type: str = "search_document",   # "search_document" | "search_query"
    capability: str = "embedding",
) -> list[float] | list[list[float]]       # str -> vec ; list -> list[vec]

async def chat(
    messages: list[dict[str, str]], *,
    capability: str,
    json_mode: bool = False,
    temperature: float = 0.0,
    max_tokens: int | None = None,
) -> str

async def rerank(
    query: str, documents: list[str], *,
    top_n: int | None = None,
    capability: str = "rerank",
) -> list[dict]        # [{"index": int, "relevance_score": float}], sorted desc

# sync — for pymongo/threadpool sync endpoints and cv_parser legacy
def embed_sync(...same kwargs...) -> ...
def chat_sync(...same kwargs...) -> str
```

**Sync wrappers**: implement the provider logic once (async). `embed_sync`/`chat_sync`
run the async coroutine via `asyncio.run(...)`. This is safe because their only callers are
Starlette **sync** endpoints executed in the threadpool (no running loop in that worker
thread). Guard: if a running event loop is detected, raise `AIProxyError` with a clear
message (caller is in async context and must use the async variant).

### Provider Protocols (`providers/base.py`)

```python
class EmbeddingProvider(Protocol):
    async def embed(self, texts: list[str], *, input_type: str, model: str) -> list[list[float]]: ...

class ChatProvider(Protocol):
    async def chat(self, messages, *, model, json_mode, temperature, max_tokens) -> str: ...

class RerankProvider(Protocol):
    async def rerank(self, query, documents, *, model, top_n) -> list[dict]: ...
```

Router holds a dispatch map, e.g. `EMBEDDING_PROVIDERS = {"cohere": CohereProvider, "ollama": OllamaProvider, "mock": MockProvider}`.
Adding a provider = add the class + one map entry. Nothing else changes.

### Config (`config.py`)

Absorbs `ai_settings.py`'s resolution logic. Env, matching the existing per-capability style:

- **Embedding:** `EMBEDDING_PROVIDER` (default `cohere`), `COHERE_EMBED_MODEL`
  (default `embed-multilingual-v3.0`), `OLLAMA_EMBED_MODEL` (fallback chain incl. existing
  `QUIZ_EMBEDDING_MODEL`, `PROFILE_ANALYSIS_EMBEDDING_MODEL`, default `nomic-embed-text`).
  Derived `EMBEDDING_DIM` (cohere→1024, ollama nomic→768) used by the mock provider so fake
  vectors match the active index dimension.
- **Rerank:** `RERANK_PROVIDER` (default `cohere`), `COHERE_RERANK_MODEL`
  (default `rerank-v3.5`). Flag `AI_MATCHING_RERANK` (default `false`).
- **Chat:** existing per-capability envs preserved
  (`QUIZ_LLM_PROVIDER`, `PROFILE_ANALYSIS_PROVIDER`, `ACCOUNT_ANALYSIS_PROVIDER`,
  `INTERVIEW_ANALYSIS_PROVIDER`, `*_MODEL_API`, `*_MODEL_LOCAL`, `QUIZ_METHOD`,
  `FAKE_ANALYSIS`, etc.). Add `cohere` as a recognized provider value and `COHERE_CHAT_MODEL`.
- **Cohere shared:** `COHERE_API_KEY` (already in `.env`), `COHERE_BASE_URL`
  (default `https://api.cohere.com`).

### Backward-compatibility shims (no big-bang)

To keep every existing import working during and after the migration:

- `utils/ai_settings.py` — keep all public functions (`get_quiz_generation_settings`, …,
  `fake_analysis_enabled`, `env_flag`, `get_huggingface_api_key`, `LLMSettings`). Internally
  they may delegate to `aiproxy.config`, but signatures/return types stay identical.
- `utils/llm_client.py::generate_chat_completion` — keep the signature; its body becomes a
  thin delegation to `aiproxy.chat(... , capability=settings.capability)`. Existing callers
  that pass an `LLMSettings` keep working unchanged.

This means the chat call sites need **no edits** to keep working (they go through the shim),
but for clarity the plan still migrates the most-central ones to call `aiproxy.chat` directly.

## Cohere API specifics (use httpx, consistent with existing providers)

- **Embed** — `POST {base}/v2/embed`, header `Authorization: Bearer {key}`, body
  `{"model", "texts": [...], "input_type": "search_document"|"search_query",
  "embedding_types": ["float"]}`. Response: `{"embeddings": {"float": [[...]]}}`.
  Batch limit 96 texts/call — chunk larger inputs.
- **Chat** — `POST {base}/v2/chat`, body `{"model", "messages":[{"role","content"}], ...}`.
  Response: `message.content[0].text`. For JSON mode, set `response_format={"type":"json_object"}`.
- **Rerank** — `POST {base}/v2/rerank`, body `{"model", "query", "documents":[...], "top_n"}`.
  Response: `{"results":[{"index","relevance_score"}]}`.

## Vector-dimension consequences (accepted — "no backfill")

`embed-multilingual-v3.0` is **1024-dim**; stored candidate/job/quiz vectors are **768-dim**.

1. **Atlas / `$vectorSearch` index** (`quiz_chunks_vector_index`, candidates `default`) must be
   manually reconfigured to `numDimensions: 1024` for new Cohere vectors to be searchable.
   This is a manual Atlas ops step — **not** in code scope. Documented in the migration note.
2. **Manual-cosine paths** (`routes/candidat/jobs.py::_cosine_similarity`,
   `services/quiz/retrieval.py` fallback) will raise on dimension-mismatched old records; these
   are already inside try/except and will be **skipped (score 0)**, so results shrink until
   records are re-embedded. Acceptable per decision.
3. **Mock/fake mode** returns vectors of the **active** embedding dimension (1024 when cohere)
   so `FAKE_ANALYSIS=1` runs don't write mismatched vectors.
4. Re-embedding, if/when wanted, uses the existing `scripts/backfill_embeddings.py` (now routed
   through the proxy, so it produces Cohere 1024-dim vectors automatically).

## Error handling

- Providers raise `ProviderError(provider, capability, detail)` on missing key / HTTP error,
  preserving the useful upstream message (like today's Ollama error extraction).
- Missing/blank `COHERE_API_KEY` when cohere is selected → `ConfigError` with a clear message.
- `router` logs `"aiproxy: {capability} -> {provider} (model={model})"` at INFO, mirroring
  the current `generate_chat_completion` logging.

## Testing

- **Unit tests** (`backend/tests/test_aiproxy_*.py`), no network/keys required:
  - config resolution (defaults, env overrides, provider aliasing, fake mode).
  - router dispatch selects the right provider per capability.
  - each provider's request/response mapping, mocking the `httpx` layer (assert URL, headers,
    body shape; feed canned responses; assert parsed output).
  - `mock` provider returns dimension-correct vectors; `embed_sync`/`chat_sync` work from a
    sync context and raise inside a running loop.
- **Smoke test** (skipped unless `COHERE_API_KEY` set): one real `embed` + `rerank` round-trip.
- Existing suites (`tests/`, `test_automation_pipeline.py`) must still import and pass
  (shims guarantee no import breakage).

## Out of scope

faster-whisper transcription; CNN job-market model; building the Atlas index migration;
writing a new backfill script (existing one is reused).

---

# Implementation plan (phased, for Sonnet 5 subagents)

Sequential phases; within Phase 2, tasks are file-disjoint and run in parallel.

### Phase 1 — Build the `aiproxy` package + shims + unit tests (one subagent)
Deliverables: full `backend/aiproxy/` tree (facade, config, router, errors, all five
providers), the two backward-compat shims, and `tests/test_aiproxy_*.py`. Nothing outside
`aiproxy/`, the two shim files, and `tests/` is touched. Acceptance: `python -c "import aiproxy"`
works; new unit tests pass; existing tests still import.

### Phase 2 — Rewire call sites (parallel, file-disjoint subagents)
- **2A Quiz subsystem:** `services/quiz/embeddings.py`, `services/quiz/retrieval.py`
  (query `input_type="search_query"`), `services/quiz/generation.py`.
- **2B Matching subsystem:** `services/ai_matching.py` (embed + chat + rerank-behind-flag),
  `services/job_automation.py`, `routes/candidat/jobs.py` (sync embed),
  `routers/jobs.py`, `routers/ai_matching.py`, `scripts/backfill_embeddings.py`.
- **2C Analysis/CV:** `utils/account_analysis.py`, `utils/interview_analyzer.py`,
  `utils/cv_parser.py` (`generate_api` → `aiproxy.chat_sync`).
Acceptance: no remaining direct external-AI HTTP calls or `InferenceClient` usage outside
`aiproxy/`; behavior preserved; imports clean.

### Phase 3 — Env + docs + final verification (one subagent / me)
`.env` additions (embedding/rerank/cohere keys), `requirements.txt` note, update the two
embedding-provider docstrings, and a short migration note in the spec. Full import sanity +
test run.
