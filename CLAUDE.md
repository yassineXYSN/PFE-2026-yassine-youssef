# Project

FastAPI (Python) backend + React (Vite) frontend — an HR / recruitment platform
(auth, account verification, team management, document/media processing).

- `backend/` — FastAPI app (routers, services). Runs in its own venv at `backend/venv`.
- `frontend/` — React + Vite + Tailwind app; source in `frontend/src`.

## Architectural Context & Querying (Graphify)

This repo has a **knowledge graph** of its own code at `graphify-out/graph.json`,
served to you as the **`graphify` MCP server** and also queryable via the `graphify`
CLI. Use it as the source of truth for how the codebase fits together.

**When to use it — you decide, don't force it.** Reach for the graph on
*architectural / dependency-heavy* questions, e.g.:
- "Where should I implement this new feature?"
- "What is the blast radius / impact of changing this schema, model, or endpoint?"
- "What are the 'god nodes' or most-connected modules?"
- "How does <subsystem> flow across backend and frontend?"

For those, **prefer querying the graph over full-repo greps** — it is far cheaper
in tokens and already resolves cross-file relationships. For simple, local tasks
(writing one function, a small edit, a question about a single file you're already
looking at) **skip the graph** — querying it there just wastes tokens. Read code
directly instead.

**How to query** (CLI; the MCP server exposes the same operations as tools):
- `graphify query "<question>"` — BFS traversal answering a question from the graph.
- `graphify affected "<Symbol>"` — reverse traversal: what is impacted by changing X (blast radius).
- `graphify path "<A>" "<B>"` — shortest dependency path between two nodes.
- `graphify explain "<Node>"` — plain-language explanation of a node and its neighbors.
- For a narrative overview of key modules and dependencies, read
  [graphify-out/GRAPH_REPORT.md](graphify-out/GRAPH_REPORT.md).

**Keep the graph fresh.** The current graph is AST-only (structure, no API cost).
After significant refactors, adding modules, or deleting code, rebuild it:
- `graphify update .` — re-extract changed code files (no LLM, free).
- `graphify update . --force` — use after refactors that delete code (allows a smaller graph).

If the graph looks stale or contradicts the code, trust the code and rebuild —
don't act on outdated dependency mapping.

> Optional richer graph: `graphify extract . --backend gemini` (or another backend)
> adds LLM-inferred semantic edges. It **costs API tokens and needs an API key**
> (e.g. `GEMINI_API_KEY`), so it is not run automatically.
