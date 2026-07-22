# Task 4 Report: `DELETE /manual-candidates/staged/{staged_id}`

## What I implemented

Added a `DELETE /staged/{staged_id}` endpoint to `backend/routers/manual_candidates.py`,
appended immediately after `parse_manual_candidate_cv`. It lets HR discard a staged CV
during review without needing a confirm step first:

- Validates `staged_id` is a valid ObjectId (400 if not).
- Looks up the staging doc; if it's already gone, returns
  `{"ok": true, "already_removed": true}` (200) instead of erroring — idempotent,
  safe to call twice (e.g. double-click, retry after a flaky network response).
- Enforces the same company-scoping rule as `_ensure_job_access`: non-superadmin
  callers can only discard staged CVs belonging to their own `company_id` (403
  otherwise).
- On a real delete: removes the file from disk via `_delete_staged_file` (already
  best-effort/OSError-swallowing from Task 3), then deletes the Mongo doc, and
  returns `{"ok": true}`.

Matches the brief's exact code from `.superpowers/sdd/task-4-brief.md` verbatim.

Also appended `test_discard_staged_removes_file_and_doc` to
`backend/tests/test_manual_candidates.py`, matching the brief's test body, with one
necessary addition (see "Concerns" below).

## TDD evidence

### RED

Command:
```
cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py::test_discard_staged_removes_file_and_doc -v
```
Result: **1 failed** — `assert del_r.status_code == 200` failed with `404 == 200`
(route didn't exist yet), exactly as expected.

### GREEN

Command:
```
cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v
```
Result:
```
tests/test_manual_candidates.py::test_parse_rejects_non_hr_role PASSED
tests/test_manual_candidates.py::test_parse_rejects_job_from_other_company PASSED
tests/test_manual_candidates.py::test_parse_happy_path_creates_staging_doc PASSED
tests/test_manual_candidates.py::test_parse_failure_cleans_up_staged_file_and_doc PASSED
tests/test_manual_candidates.py::test_discard_staged_removes_file_and_doc PASSED
======================= 5 passed, 34 warnings in 4.28s ========================
```
All 5 tests pass (the 4 pre-existing ones stayed green, plus the new one).

## Files changed

- `backend/routers/manual_candidates.py` — appended `discard_staged_manual_candidate`
  endpoint (22 lines), nothing else touched.
- `backend/tests/test_manual_candidates.py` — appended
  `test_discard_staged_removes_file_and_doc` (with one deviation from the brief's
  literal text, see below).

## Self-review findings

- **Completeness**: idempotent delete confirmed — second call in the test asserts
  `already_removed: true` with a 200, not an error.
- **Quality**: matches file's existing style (docstring, `ObjectId.is_valid` guard,
  `HTTPException` usage, `require_roles(HR_SIDE_ROLES)` auth, company-scoping check
  mirroring `_ensure_job_access`).
- **Discipline**: diff confirmed via `git diff` before committing — `/parse` endpoint
  body is completely untouched; router change is a pure append after it; test file
  change is a pure append after the last existing test.
- **Testing**: test asserts the file is gone (`os.path.isfile` false), the Mongo doc
  is gone (`find_one` returns `None`), and a second delete call is a safe no-op
  (`already_removed: true`, still 200) — matches the brief's exact assertions.

## Concerns

One deviation from the brief's literal test text, needed to make the test actually
pass (not a style choice): the brief's test issues three sequential requests through
the module-level `client` (`POST /parse`, then two `DELETE`s) in a single test
function. `TestClient`, used without a `with` block, spins up a fresh asyncio event
loop for each top-level call. The existing autouse fixture
(`_fresh_async_mongo_client_per_test`) resets the cached Motor client
(`mongodb_async._client`) once *between tests*, but this new test needed it reset
*between requests within the same test* — otherwise the second and third requests hit
`RuntimeError: Event loop is closed` because the cached Motor client was still pinned
to the first request's (now-closed) loop. This reproduced consistently and is the same
root cause the existing fixture's docstring already documents, just triggered at a
finer granularity because this is the first test in the file to make more than one
request.

Fix: added `mongodb_async._client = None` before each of the two `client.delete(...)`
calls inside the new test only (no changes to the shared autouse fixture or to any
other test). This is scoped entirely to the new test function I was appending, so it
doesn't touch shared test infrastructure or violate the "append only" instruction in
spirit — but it is a deviation from the brief's literal test source, so flagging it
explicitly. No other files or MongoDB/Docker infrastructure were touched.

Also noting: this repo's `.superpowers/sdd/` directory contained stale files (`task-4-report.md`
previously held an unrelated report about `backend/routers/team.py`, and `task-5..8`
brief/report files and several `review-*.diff` files exist for work not part of this
task assignment). I overwrote only `task-4-report.md` with this task's content, per
instructions; I did not touch `task-5..8` files or the diff files.
