# Task 3 Report: backend/auth.py — verify/resend/force-activate endpoints

## Status: DONE

## What I implemented

Followed `task-3-brief.md` steps 1-9 verbatim in `backend/auth.py`:

1. **Imports** (after the existing `from utils.email_utils import send_email` line): added `import os` and imports from `utils.verification_tokens` (`issue_verification_token`, `consume_verification_token`, `invalidate_tokens_for_email`, `VerificationError`) and `utils.account_status` (`sync_account_status`).

2. **`admin_create_user`**: added `background_tasks: BackgroundTasks` as the first parameter. Right before the final `return`, added the pending-status branch that issues a verification token, commits it, builds a `verify_link` from `FRONTEND_URL` env var (default `http://localhost:8080`), and queues an activation email via `background_tasks.add_task(send_email, ...)`. Only triggers when `status == "pending"`; the return shape (`{"id", "email", "role", "status"}`) is unchanged.

3. **`POST /verify-account`** (public): consumes a token via `consume_verification_token`, looks up the user by the returned email, calls `sync_account_status(cursor, mongo_db, user["id"], "active")`, commits. Returns 400 on missing/invalid/expired/used token, 404 if the account row is missing.

4. **`POST /admin/resend-verification`** (admin/superadmin only): looks up the target user+status by `user_id`, 404s if not found, 400s if not `pending`, issues a fresh token, commits, then queues a resend email.

5. **`POST /admin/force-activate`** (admin/superadmin only): looks up the target user+status by `user_id`, 404s if not found, 400s if not `pending`, invalidates outstanding tokens for that email, calls `sync_account_status(...)` to set `active` in MySQL + Mongo, commits.

All three new endpoints and the modified `admin_create_user` follow the existing `db_gen = get_db(); db = next(db_gen); try: ... finally: try: next(db_gen) except StopIteration: pass` pattern and use the file's `row()` helper, exactly as specified.

One incidental, correct side effect: ruff's auto-fix-on-save hook (configured project-wide via `.claude/settings.local.json`, not something I added) removed the now-redundant local `import os` inside `forgot_password` since `os` is now imported at module level. This is a harmless cleanup, not a functional change — `forgot_password` still calls `os.getenv(...)` exactly as before.

Also created `backend/tests/test_auth_verification_endpoints.py` — transcribed exactly from the brief (Step 7), no additions or omissions.

## Route registration sanity check (Step 6)

```
cd backend && venv/Scripts/python.exe -c "from main import app; paths = sorted(r.path for r in app.router.routes if '/verify-account' in r.path or 'resend-verification' in r.path or 'force-activate' in r.path); print(paths)"
```
Output:
```
['/api/auth/admin/force-activate', '/api/auth/admin/resend-verification', '/api/auth/verify-account']
```
Matches the brief's expected output exactly.

## Tests run (implementation-first, not strict TDD)

Implemented the code first, then wrote/ran the brief's test file, per the plan's stated design ("the endpoint tests are written after implementation"). Full evidence (clean DB state):

```
cd backend && venv/Scripts/python.exe -m pytest tests/test_account_verification.py tests/test_auth_verification_endpoints.py -v
```

```
tests/test_account_verification.py::test_issue_then_consume_token_succeeds PASSED
tests/test_account_verification.py::test_consume_unknown_token_raises PASSED
tests/test_account_verification.py::test_consume_used_token_raises PASSED
tests/test_account_verification.py::test_consume_expired_token_raises PASSED
tests/test_account_verification.py::test_issuing_new_token_invalidates_previous_unused_token PASSED
tests/test_account_verification.py::test_invalidate_tokens_for_email_marks_all_unused_as_used PASSED
tests/test_account_verification.py::test_sync_account_status_updates_mysql_and_mongo PASSED
tests/test_auth_verification_endpoints.py::test_verify_account_missing_token_returns_400 PASSED
tests/test_auth_verification_endpoints.py::test_verify_account_unknown_token_returns_400 PASSED
tests/test_auth_verification_endpoints.py::test_verify_account_expired_token_returns_400_and_does_not_activate PASSED
tests/test_auth_verification_endpoints.py::test_resend_verification_requires_admin_role PASSED
tests/test_auth_verification_endpoints.py::test_resend_verification_rejects_non_pending_user PASSED
tests/test_auth_verification_endpoints.py::test_force_activate_requires_admin_role PASSED
tests/test_auth_verification_endpoints.py::test_force_activate_activates_pending_user PASSED

======================= 14 passed, 26 warnings in 8.69s =======================
```

14/14 passed (7 from Task 2's `test_account_verification.py` + 7 from my new `test_auth_verification_endpoints.py`). The 26 warnings are pre-existing library-level `PydanticDeprecatedSince20` and SWIG `DeprecationWarning`s that surface whenever `main.py`/the full FastAPI app is imported (confirmed by running Task 2's file alone — 0 warnings — versus with `main.py` imported); they are not introduced by my changes and are outside this task's scope.

Also ran ruff on the changed files:
- `backend/tests/test_auth_verification_endpoints.py`: `All checks passed!`
- `backend/auth.py`: pre-existing `E701` (multiple statements on one line via `try: next(db_gen) / except StopIteration: pass`) findings, same style used throughout the file before my change (confirmed: `git show HEAD:auth.py` already had 18 E701 findings; my change added 4 more instances of the identical existing pattern, going to 26). Not a regression — this is the file's established, brief-mandated convention, and ruff's auto-fix hook does not rewrite E701 automatically.

## Self-review findings

1. **Brief's "Expected: 15 passed" (Step 8) is a miscount — actual is 14, and that's correct.** Task 2's `test_account_verification.py` has 7 tests, and the brief's own `test_auth_verification_endpoints.py` content (which I transcribed verbatim) has 7 tests, totaling 14, not 15. Verified via `--collect-only` on both files independently. This is a documentation error in the brief, not a gap in my implementation — I did not add or omit any test.

2. **Test-isolation gap in the brief's `test_verify_account_expired_token_returns_400_and_does_not_activate` test (pre-existing in the brief's spec, not introduced by me).** The test manually inserts a row into `account_verifications` with a hardcoded fixed token (`"b" * 64`) for a `pending_user`-fixture-created user. The `pending_user` fixture's teardown (`_delete_user`) only does `DELETE FROM users WHERE id = %s` — since `account_verifications` has no foreign key to `users`/`profiles` (confirmed via `SHOW CREATE TABLE account_verifications`; it's a free-standing `email`/`token` table), the manually-inserted row with the fixed token is never cleaned up. Running this single test twice in a row (or running the suite twice against a persistent DB) causes `pymysql.err.IntegrityError: Duplicate entry '...' for key 'token'` on the second run, because `token` has a UNIQUE constraint. I reproduced this deterministically (ran the single test back-to-back; the second run failed with that exact error), then manually deleted the stray row from `account_verifications` before producing the final clean 14/14 test run above. **I did not modify the test file to fix this**, since I was instructed to transcribe it exactly as given in the brief — flagging it here instead. This will bite CI or any developer who runs this test file more than once against a persistent DB without manual cleanup. Recommend a fast-follow: either derive the token from `uuid.uuid4().hex` instead of a fixed `"b"*64` string, or have `_delete_user` also `DELETE FROM account_verifications WHERE email = %s`.

3. **File size**: `backend/auth.py` grew from ~315 lines to 450 lines. Per the task instructions this is expected/acceptable for this plan and I did not split it into multiple files.

4. No extra validation, fields, or endpoints were added beyond what the brief specified. `admin_create_user`'s return shape is unchanged (`{"id", "email", "role", "status"}`). All three new routes are registered at exactly the paths required.

## Files changed

- `backend/auth.py` — modified (imports, `admin_create_user` signature + pending-email logic, three new endpoints)
- `backend/tests/test_auth_verification_endpoints.py` — created (transcribed exactly from brief)

## Commit

```
git add backend/auth.py backend/tests/test_auth_verification_endpoints.py
git commit -m "Add account verification endpoints: verify, resend, force-activate"
```

## Concerns

- See self-review finding #2 above (test-isolation gap for the fixed-token expired-token test) — real issue in the brief's test code, worth a fast-follow fix in a later task, but does not block Task 3 since the implementation code itself is correct and the full suite passes 14/14 on a clean DB state.
- Self-review finding #1 (brief's "15 passed" vs actual/correct 14) is purely a documentation discrepancy, no action needed.

---

## Post-review fix: rerun-safety leak in `test_auth_verification_endpoints.py` (Important finding)

### Status: DONE

This addresses the task reviewer's "Important" finding, which confirms and reproduces self-review finding #2 above: `test_verify_account_expired_token_returns_400_and_does_not_activate` inserts an `account_verifications` row with a hardcoded token (`"b" * 64`) that no fixture teardown ever removes, because `account_verifications` has no FK to `users`/`profiles` and `_delete_user` only did `DELETE FROM users WHERE id = %s`. Since `account_verifications.token` is `UNIQUE`, re-running the test against a persistent DB raises `pymysql.err.IntegrityError: Duplicate entry '...' for key 'token'` on the second run.

### What I changed

File touched: `backend/tests/test_auth_verification_endpoints.py` only (as instructed — no other files modified).

- Gave `_delete_user` a new optional `email=None` parameter. When `email` is provided, it now runs `DELETE FROM account_verifications WHERE email = %s` before deleting the user row — mirroring the `_cleanup_email` pattern already used correctly in the sibling file `backend/tests/test_account_verification.py`.
- Updated both call sites to pass the user's email through:
  - the `pending_user` fixture teardown: `_delete_user(user_id, mongo_db, email)`
  - `test_resend_verification_rejects_non_pending_user`'s `finally` block: `_delete_user(user_id, mongo_db, email)`

```python
def _delete_user(user_id, mongo_db, email=None):
    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            if email is not None:
                cursor.execute("DELETE FROM account_verifications WHERE email = %s", (email,))
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        _release(gen)
    mongo_db.hr_profiles.delete_one({"_id": user_id})
```

This means every test that creates a `pending_user` (and thus may or may not insert an `account_verifications` row) now also cleans up any such row keyed by that user's email during teardown — regardless of which test inserted it — so the suite is safe to run repeatedly against a persistent DB.

### Pre-existing stale row from the reviewer's live reproduction

Before verifying, I found the DB already had the orphaned `token = "b"*64` row left over from the reviewer's earlier reproduction (same one described in self-review finding #2). Confirmed this by running the test once before any manual cleanup — it failed immediately with the exact `Duplicate entry '...' for key 'token'` IntegrityError described in the finding. I deleted that one stray row directly (`DELETE FROM account_verifications WHERE token = 'b'*64`, 1 row affected) via a one-off script using the app's own `get_db()` connection, since this pre-existing bad state predates my fix and isn't something a code change can retroactively clean up. After that one-time cleanup, all subsequent verification runs below are on a clean slate and confirm the fix holds going forward.

### Verification: two consecutive runs of the previously-failing test

Run 1:
```
cd backend && venv/Scripts/python.exe -m pytest tests/test_auth_verification_endpoints.py::test_verify_account_expired_token_returns_400_and_does_not_activate -v
...
tests/test_auth_verification_endpoints.py::test_verify_account_expired_token_returns_400_and_does_not_activate PASSED [100%]
======================= 1 passed, 26 warnings in 6.87s ========================
```

Run 2 (immediately after, same persistent DB, no manual cleanup in between):
```
cd backend && venv/Scripts/python.exe -m pytest tests/test_auth_verification_endpoints.py::test_verify_account_expired_token_returns_400_and_does_not_activate -v
...
tests/test_auth_verification_endpoints.py::test_verify_account_expired_token_returns_400_and_does_not_activate PASSED [100%]
======================= 1 passed, 26 warnings in 6.56s ========================
```

Both runs passed — the test is now rerun-safe.

### Verification: full test file (twice, for extra confidence)

```
cd backend && venv/Scripts/python.exe -m pytest tests/test_auth_verification_endpoints.py -v
...
tests/test_auth_verification_endpoints.py::test_verify_account_missing_token_returns_400 PASSED
tests/test_auth_verification_endpoints.py::test_verify_account_unknown_token_returns_400 PASSED
tests/test_auth_verification_endpoints.py::test_verify_account_expired_token_returns_400_and_does_not_activate PASSED
tests/test_auth_verification_endpoints.py::test_resend_verification_requires_admin_role PASSED
tests/test_auth_verification_endpoints.py::test_resend_verification_rejects_non_pending_user PASSED
tests/test_auth_verification_endpoints.py::test_force_activate_requires_admin_role PASSED
tests/test_auth_verification_endpoints.py::test_force_activate_activates_pending_user PASSED
======================= 7 passed, 26 warnings in 7.55s =========================
```

Re-ran the same command a second time with identical results (`7 passed`), confirming no leftover state across full-file runs either.

### Files changed

- `backend/tests/test_auth_verification_endpoints.py` — modified (`_delete_user` gains optional `email` param + cleanup statement; both call sites updated). 1 file changed, 5 insertions(+), 3 deletions(-).

### Commit

```
git add backend/tests/test_auth_verification_endpoints.py
git commit -m "Fix rerun-safety leak in test_auth_verification_endpoints.py teardown"
```
Commit: `e5e69c0`

### Concerns

None outstanding. This closes self-review finding #2 from the original Task 3 report and the reviewer's Important finding. The task-3 implementation code (`backend/auth.py`) itself was not touched — this was purely a test-file teardown fix.
