# Task 3: `manual_candidates` router — POST /parse

## Implementation Summary

Implemented a new HR-side router, `backend/routers/manual_candidates.py`, exposing
`POST /api/manual-candidates/parse`. HR uploads a CV (multipart: `job_id` form field +
`cv` file) for a specific job; the handler validates the caller's role and job/company
scoping, saves the file to `backend/static/uploads/`, stages a document in the
`hr_manual_cv_staging` collection, parses the CV via `parse_cv_bytes` (from Task 1), and
returns `{staged_id, filename, content_type, size, parsed}`. On parse failure, the
staged file and Mongo document are both rolled back (deleted) before a 500 is raised.

`_ensure_job_access(db, job_id, current_user)` follows the exact scoping pattern from
`routers/applications.py::get_applications_for_job` (400 invalid id, 404 missing job,
403 cross-company, 403 `chef_departement` department mismatch, superadmin bypass) and is
exported for reuse by the future DELETE `/staged/{id}` and POST `/confirm` endpoints
(not built here, per scope).

## Files Changed

- **New:** `backend/routers/manual_candidates.py` — router, `_ensure_job_access`,
  `_save_cv_upload`, `_delete_staged_file`, `POST /parse` handler. Implemented verbatim
  per the brief's Step 3 code.
- **Modified:** `backend/main.py` — added `manual_candidates` to the `from routers import
  (...)` block and `app.include_router(manual_candidates.router, prefix="/api")` right
  after `app.include_router(candidates.router, prefix="/api")`, per the brief's Step 3
  instructions. (Incidental: the repo's PostToolUse formatter hook also stripped three
  trailing-whitespace-only blank lines inside `lifespan()` while reformatting — harmless,
  confirmed via `git diff`. Also incidental: the same hook strips a new import that has
  no usage anywhere in the file yet — required doing the import + `app.include_router(...)`
  line as one combined `Edit` call spanning both locations so the import wasn't stripped
  before its usage existed.)
- **New/Modified:** `backend/tests/test_manual_candidates.py` — pre-existing file kept
  matching the brief's Step 1 content, plus two additions (see "Deviations" below):
  an autouse pytest fixture resetting the cached async Mongo client per test, and
  file-cleanup logic in `_cleanup_job`.

## TDD Evidence

### RED (before implementation)

```
cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v
...
tests/test_manual_candidates.py::test_parse_rejects_non_hr_role FAILED (404 != 403)
tests/test_manual_candidates.py::test_parse_rejects_job_from_other_company FAILED (404 != 403)
tests/test_manual_candidates.py::test_parse_happy_path_creates_staging_doc FAILED (404 != 200)
======================= 3 failed, 27 warnings in 4.26s ========================
```
All three failed with 404 (`{"detail":"Not Found"}`), confirming the route did not exist
yet and MongoDB connectivity itself was fine (the `MongoDB connection established
successfully` log line appeared before the failures).

### GREEN (after implementation)

```
cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v
...
tests/test_manual_candidates.py::test_parse_rejects_non_hr_role PASSED   [ 33%]
tests/test_manual_candidates.py::test_parse_rejects_job_from_other_company PASSED [ 66%]
tests/test_manual_candidates.py::test_parse_happy_path_creates_staging_doc PASSED [100%]
======================= 3 passed, 29 warnings in 4.55s ========================
```

Re-ran twice more to confirm no flakiness, and confirmed `static/uploads/` and the
`hr_manual_cv_staging`/`hr_jobs` collections are empty of test artifacts after each run.

Spot-check regression run (candidates authz, saved-jobs route ordering, account-setup
parse-cv endpoint, `parse_cv_bytes` unit tests, CORS/docs tests — 12 tests) all passed,
confirming no breakage from the `main.py` router registration change.

## Deviations from the brief (both confined to the test file, both necessary for the
tests to pass reliably)

1. **Autouse fixture resetting `database.mongodb_async._client`.** Root cause: FastAPI's
   `TestClient` (starlette 0.50, this repo's version), when not used as a context
   manager (`with TestClient(app) as client:`), spins up a brand-new anyio blocking
   portal — and therefore a brand-new asyncio event loop — for *every single* `.post()`
   call, then tears it down immediately after. `database/mongodb_async.py` caches a
   single module-level `AsyncIOMotorClient` (`_client`) for the life of the Python
   process; Motor's client lazily caches the event loop it first observes. The result:
   the first test's DB call bound the client's internal loop reference to that test's
   (now-closed) portal loop, and a later test's DB call crashed with `RuntimeError:
   Event loop is closed` when Motor tried to schedule work on the stale loop. This is
   not a MongoDB connectivity problem (verified — the connection succeeds every time;
   only the *second* DB round-trip within the test session failed) and not something
   fixable in the router; I added an autouse `pytest.fixture` in the test file that
   resets `mongodb_async._client = None` before/after each test, forcing a fresh client
   to be constructed inside that test's own (currently running, open) event loop. This
   is a known, standard workaround for this exact Motor+TestClient interaction and is
   confined entirely to the test file (in scope).
2. **File cleanup in `_cleanup_job`.** The brief's `_cleanup_job` deleted Mongo documents
   (`hr_jobs`, `hr_manual_cv_staging`, `candidates`, `job_applications`) but never
   deleted the CV file that `_save_cv_upload` writes to `static/uploads/`, so every test
   run left an orphaned file behind (confirmed: re-running the suite twice left 2 stray
   `manualcv_*` files). Added a loop in `_cleanup_job` that finds each staged doc's
   `file_path` and removes it from disk before deleting the Mongo records. Verified
   `static/uploads/` has zero `manualcv_*` files after repeated test runs.

Both changes only touch test-file plumbing; the actual assertions, request payloads, and
expected status codes from the brief are unchanged.

## Self-Review Findings

**Completeness**
- `POST /manual-candidates/parse` implemented exactly per brief signature and body.
- `_ensure_job_access` matches `applications.py`'s scoping pattern (400/404/403/403,
  superadmin bypass) and is a standalone, reusable async function as required for
  future Task 4/5 reuse.
- Cleanup-on-parse-failure: verified in code — `except Exception` branch calls
  `_delete_staged_file(file_path)` then `db.hr_manual_cv_staging.delete_one(...)` before
  raising 500, so no orphaned doc or file survives a `parse_cv_bytes` failure. (Not
  separately exercised by a test — none of the 3 required tests cover this path — but
  the code matches the brief exactly and the logic is straightforward.)
- `main.py` changes match the brief precisely: import added to the multi-line block,
  registration line placed immediately after `candidates.router`.

**Quality**
- Style matches `routers/candidates.py` / `routers/applications.py`: `APIRouter` with
  prefix/tags, `Depends(require_roles(...))`, async Motor calls, `HTTPException` with
  explicit status codes, docstring on the handler.
- No extraneous refactors to touched files beyond the auto-formatter's whitespace
  trimming (verified via `git diff`).

**Discipline**
- No DELETE `/staged/{id}` or POST `/confirm` endpoints were built — `_ensure_job_access`
  is structured as a standalone function specifically so those future tasks can import
  and call it without router-internal coupling.
- Did not touch Docker, `docker-compose.yml`, `backend/Dockerfile`, or `backend/.env`.

**Testing**
- All 3 required tests pass, run 3x in a row with no flakiness.
- Every test's `try/finally` calls `_cleanup_job`, which now also removes the staged
  file from disk — verified zero leftover Mongo docs and zero leftover
  `static/uploads/manualcv_*` files after multiple runs.
- Broader regression spot-check (12 unrelated tests across candidates/saved-jobs/
  account-setup/CORS) all still pass.

## Commits

- `ed7ef4e` — `feat(backend): add POST /manual-candidates/parse endpoint`
  (`backend/routers/manual_candidates.py` new, `backend/main.py` modified,
  `backend/tests/test_manual_candidates.py` new)

## Concerns

- The Motor/TestClient event-loop caching issue (see Deviations #1) is a latent
  footgun in `database/mongodb_async.py`'s module-level singleton client that will
  bite any *future* test suite exercising more than one real Motor round-trip through
  bare (non-context-managed) `TestClient` calls — e.g. the upcoming Task 4/5 tests for
  DELETE `/staged/{id}` and POST `/confirm`. I did not fix it at the source (out of
  scope for this task — `database/mongodb_async.py` is a shared module used by many
  other routers, and the task brief restricted me to the router file, `main.py`, and
  the test file). Recommend either applying the same autouse-fixture pattern in future
  test files, or fixing it centrally in `mongodb_async.py` (e.g., don't cache `_client`
  across event loops) as a small follow-up.

## Review-Finding Fix: parse-failure cleanup path had zero test coverage

**Finding:** the `except Exception` branch in `POST /manual-candidates/parse`
(`backend/routers/manual_candidates.py`, lines 93-98) correctly deletes the just-saved
CV file (`_delete_staged_file(file_path)`) and the just-inserted
`hr_manual_cv_staging` doc (`db.hr_manual_cv_staging.delete_one(...)`) before raising a
500 — but none of the 3 original tests exercised this path, so a regression (reordering
the cleanup calls, dropping the `await`, etc.) would go undetected.

**Fix:** added a 4th test, `test_parse_failure_cleans_up_staged_file_and_doc`, to
`backend/tests/test_manual_candidates.py`. It monkeypatches
`routers.manual_candidates.parse_cv_bytes` (the name as imported into that module) with
an `async def` raiser that throws `ValueError("boom")`, snapshots
`get_upload_dir()`'s file listing and `hr_manual_cv_staging` doc count for the job
before the request, POSTs a real small PDF payload, asserts the response is `500` with
`"CV Parsing failed"` in the detail, then asserts both the doc count and the upload-dir
file listing are unchanged (no orphaned Mongo doc, no orphaned file on disk). No
production code was modified — `manual_candidates.py` was already correct.

### Final passing run (4/4)

```
cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v
...
tests/test_manual_candidates.py::test_parse_rejects_non_hr_role PASSED   [ 25%]
tests/test_manual_candidates.py::test_parse_rejects_job_from_other_company PASSED [ 50%]
tests/test_manual_candidates.py::test_parse_happy_path_creates_staging_doc PASSED [ 75%]
tests/test_manual_candidates.py::test_parse_failure_cleans_up_staged_file_and_doc PASSED [100%]
======================= 4 passed, 31 warnings in 4.27s ========================
```

### Confirmation the new test genuinely catches a regression

Temporarily commented out `_delete_staged_file(file_path)` in the `except` block of
`manual_candidates.py` (leaving `delete_one(...)` intact) and reran just the new test:

```
cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py::test_parse_failure_cleans_up_staged_file_and_doc -v
...
FAILED tests/test_manual_candidates.py::test_parse_failure_cleans_up_staged_file_and_doc
AssertionError: orphaned upload file left behind after failed parse
assert {...} == {...}
  Extra items in the left set:
  'manualcv_hr-1_783023dcfb30efc7.pdf'
======================= 1 failed, 26 warnings in 4.21s ========================
```

Confirmed the test correctly detects a missing-cleanup regression. Removed the orphaned
file left behind by that run, restored `manual_candidates.py` exactly (`git diff
backend/routers/manual_candidates.py` returns empty), and reran the full suite to
confirm green again (4/4 passed, shown above).
