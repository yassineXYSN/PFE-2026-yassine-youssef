# aiproxy — provider-agnostic AI gateway

Every external AI call in this backend goes through `aiproxy`. Application code
never talks to Cohere / HuggingFace / OpenAI / Ollama directly — it calls a
capability function and the proxy routes it to the configured provider. Swapping
a provider is a **config change** (plus, for a brand-new provider, one small file).

## Use it

```python
import aiproxy

# Embeddings (async). str -> one vector; list -> list of vectors.
vec  = await aiproxy.embed("some document text")                       # search_document
qvec = await aiproxy.embed("a query", input_type="search_query")       # query side
vecs = await aiproxy.embed(["a", "b", "c"])                            # batched internally

# Chat (async). Raises ValueError if the resolved provider is "mock"
# (callers keep their own FAKE_ANALYSIS / mock branch for chat).
text = await aiproxy.chat(messages, capability="quiz_generation", json_mode=True)

# Rerank (async).
ranked = await aiproxy.rerank("query", ["doc a", "doc b"], top_n=10)
# -> [{"index": 1, "relevance_score": 0.83}, ...] sorted desc

# Sync variants — ONLY from sync endpoints/threadpool (no running event loop):
vec  = aiproxy.embed_sync("text")
text = aiproxy.chat_sync(messages, capability="account_analysis")
```

`input_type` matters for Cohere retrieval quality: use `"search_document"` for
content you store/index and `"search_query"` for the transient query side of a
search. Ollama ignores it. **Matching uses `search_document` on both sides**
(it's bidirectional with stored vectors); only quiz retrieval uses `search_query`.

## Configure it (env vars)

| Capability | Provider var (default) | Model var (default) |
|---|---|---|
| Embedding | `EMBEDDING_PROVIDER` (`cohere`) | `COHERE_EMBED_MODEL` (`embed-multilingual-v3.0`, 1024-dim) · `OLLAMA_EMBED_MODEL` (`nomic-embed-text`, 768-dim) |
| Rerank | `RERANK_PROVIDER` (`cohere`) | `COHERE_RERANK_MODEL` (`rerank-v3.5`) |
| Chat (per capability) | `QUIZ_LLM_PROVIDER`, `PROFILE_ANALYSIS_PROVIDER`, `ACCOUNT_ANALYSIS_PROVIDER`, `INTERVIEW_ANALYSIS_PROVIDER` (`huggingface`) | `*_MODEL_API` / `*_MODEL_LOCAL` · `COHERE_CHAT_MODEL` (`command-r-plus`) |

Shared: `COHERE_API_KEY`, `COHERE_BASE_URL` (`https://api.cohere.com`),
`HUGGINGFACE_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`.
Flags: `AI_MATCHING_RERANK` (`false`) enables rerank in candidate/job matching;
`FAKE_ANALYSIS` (`0`) returns dimension-correct mock embeddings and mock analysis.

### Examples

- **Embeddings on Ollama instead of Cohere:** `EMBEDDING_PROVIDER=ollama` (768-dim).
- **Quiz generation on Cohere instead of HF:** `QUIZ_LLM_PROVIDER=cohere` + `COHERE_CHAT_MODEL=command-r-plus`.
- **Turn on rerank in matching:** `AI_MATCHING_RERANK=true`.

## Add a brand-new provider

1. Add `providers/<name>.py` implementing the relevant `Protocol`(s) from
   `providers/base.py` (`EmbeddingProvider` / `ChatProvider` / `RerankProvider`).
2. Register it in `router.py` (one line in the relevant `*_PROVIDERS` map + a
   dispatch branch passing its connection kwargs).
3. Set the capability's `*_PROVIDER` env var to `<name>`. Done — no call site changes.

## Layout

```
aiproxy/
  __init__.py     public facade: embed/embed_sync, chat/chat_sync, rerank
  config.py       capability -> {provider, model, keys} resolution
  router.py       capability -> provider dispatch (+ mock/fake handling)
  errors.py       AIProxyError, ProviderError, ConfigError
  providers/      cohere, huggingface, ollama, openai, mock (+ base Protocols)
```

## ⚠️ Embedding dimension note (Cohere = 1024, old Ollama = 768)

Switching the default embedding provider to Cohere changes vector dimension from
768 to 1024. Existing stored candidate/job/quiz vectors are 768-dim and are **not
comparable** to new 1024-dim vectors. Before matching/search works on existing
data in a real environment:

1. Reconfigure the MongoDB Atlas vector indexes (`quiz_chunks_vector_index`,
   candidates `default`) to `numDimensions: 1024`.
2. Re-embed existing records (e.g. `scripts/backfill_embeddings.py`, which now
   produces Cohere 1024-dim vectors automatically).

Until then, old records return empty/degraded results (dimension-mismatch errors
are caught and skipped). This is the accepted "no backfill" trade-off.
