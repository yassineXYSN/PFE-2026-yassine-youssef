# SDD Progress Ledger — Manual Candidate CV Upload

Branch: dev_feature_manual_candidate_cv_upload (off dev)
Plan: docs/superpowers/plans/2026-07-20-manual-candidate-cv-upload.md
Spec: docs/superpowers/specs/2026-07-20-manual-candidate-cv-upload-design.md
Base commit: d5b152d

## Tasks

- [x] Task 1: Shared bytes-based CV parser (PDF + DOCX) — backend/utils/account_analysis.py
- [x] Task 2: DOC/DOCX support in candidate parse-cv endpoint — backend/routes/candidat/account_setup.py
- [x] Task 3: manual_candidates router — POST /parse
- [x] Task 4: manual_candidates router — DELETE /staged/{staged_id}
- [x] Task 5: manual_candidates router — POST /confirm
- [x] Task 6: i18n keys — frontend/src/assets/translations/hr/jobs-candidates.js
- [x] Task 7: Entry-point button + modal shell (Phase 1: drop zone)
- [x] Task 8: Parsing phase (Phase 2) — concurrency, progress, error isolation
- [x] Task 9: Review phase (Phase 3) — one-at-a-time edit + CV preview
- [x] Task 10: Submit phase (Phase 4) — batch confirm, results, list refresh

Task 1: complete (commit d5b152d..a48827d, review clean; Minor note: pytest-asyncio not tracked in requirements.txt, pre-existing gap not introduced by this task)
Task 2: complete (commits a48827d..c10e68f, review clean after 1 fix round: original tests were vacuous since auth runs before the extension check and both tests never reached that code path; fixed in c10e68f by monkeypatching get_user_id_from_token at its account_setup.py call site so tests exercise the real extension-check + parse_cv_bytes path)
Task 3: complete (commits c10e68f..371310e, review clean after 1 fix round: missing test coverage for the plan-mandated parse-failure cleanup path, fixed in 371310e). Env note: required bringing up local MongoDB (`docker compose up -d mongodb`) and adding `?directConnection=true` to backend/.env's MONGODB_URL (gitignored, local-only) since the mongodb-atlas-local image runs as a single-node replica set. Also: TestClient(app) bare instantiation creates a fresh event loop per request, which staled database/mongodb_async.py's cached AsyncIOMotorClient across tests in the same session — worked around via an autouse pytest fixture in test_manual_candidates.py that resets the cached client per test (test-only, file-scoped since no conftest.py exists; Tasks 4/5 append to this same file so they inherit the fixture for free). A stray out-of-scope Dockerfile edit from an earlier interrupted session was stashed (`git stash`), not committed.
Task 4: complete (commit 371310e..2443518, review clean). Note: per-test fixture wasn't enough for tests issuing multiple sequential TestClient calls in one test (each call gets its own event loop) — worked around inline in this test via extra `mongodb_async._client = None` resets. Reviewer flagged (non-blocking) that Task 5 should extract this into a shared test helper rather than repeating it ad hoc, since parse->confirm tests will need multiple sequential calls too.
Task 5: complete (commits 2443518..680fba7, review clean after 2 fix rounds). Round 1 fixed: missing AIMatchingService import (Critical — vectorization was silently NameError'ing/no-op'ing every call), weak partial-failure test (only 1 bad item, didn't prove sibling isolation), incomplete rollback (only deleted orphaned candidates doc), model placement. Round 2 fixed: rollback was still incomplete — didn't delete the job_applications doc when the later staging-status-update step failed, trading one orphan class for a dangling-application orphan; fixed by tracking both cand_result/app_result and independently, non-maskingly rolling back both, with a dedicated test forcing the staging-update step specifically to fail. Added `_call()` test helper in test_manual_candidates.py for multi-request-per-test sequences (event-loop-per-TestClient-call issue). Final: 8/8 tests passing in test_manual_candidates.py.

ALL BACKEND TASKS (1-5) COMPLETE. Frontend tasks 6-10 remain.
Task 6: complete (commit 680fba7..7035640, review clean)
Task 7: complete (commit 7035640..c79e813, review clean). Session was interrupted mid-task once; resumed the same agent via SendMessage rather than redispatching, which preserved its uncommitted work. Agent bootstrapped throwaway local HR/company/job test fixtures (not committed) and started MariaDB (existing docker-compose service, no config changes) to verify login end-to-end via Playwright.
Task 8: complete (commits c79e813..4865635, review clean after 4 fix rounds — unusually iterative, all on the same client-side concurrency guard for the parse worker pool). Session interrupted twice mid-task; resumed the same agent via SendMessage both times. Round 1 review: nextIdx claiming/failure-counter/patchQueueItem all correct, but found overlapping runParsingQueue invocations (from per-row retry or Reprendre) could break the isParsingActive gate. Round 2 fix (activeRunRef guard + disabled buttons) closed that but left cancel-mid-batch permanently locking out restart. Round 3 fix (reset ref on cancel + try/finally hardening) closed that but introduced a 4th-order bug: an orphaned cancelled run's delayed finally could unconditionally stomp a newer active run's state. Round 4 fix: monotonic runGenerationRef token so finally only resets state if it's still "the run of record" — final re-review traced 5 chained/edge scenarios and approved clean. Root lesson: the first 3 rounds treated activeRunRef as one concern; round 4 correctly split it into entry-gating vs exit-gating, which is what actually closed the bug class.
Task 9: complete (commits 4865635..686b6ec, review clean after 1 fix round: CvPreview's non-PDF fallback leaked a blob URL every render instead of once-per-file, fixed by unifying it into the same useEffect+cleanup pattern the PDF branch already used correctly). Session interrupted twice mid-task; resumed the same agent via SendMessage both times.
Task 10: complete (commits 686b6ec..e4d38ac, review clean after 1 fix round: submitConfirmed() was called directly in the render body instead of via useEffect — a real double-submit risk under StrictMode + the backend's non-atomic staged-status guard; fixed with a synchronously-set ref guard, correctly reset in resetAndClose so a legitimate second batch isn't blocked). Mid-task, user reported CV parsing was returning fake data — root cause: backend/.env's FAKE_ANALYSIS had been left at 1 from earlier testing across this whole session; fixed to 0 (repo now has a hook blocking direct .env edits going forward, use .env.docker.example instead). Note: backend/Dockerfile, requirements.txt, utils/cv_parser.py, deleted tests/test_cv_parser.py, deleted utils/emotion/*, and untracked backend/docker/ are the USER's own separate concurrent Docker-networking work, unrelated to this plan — never touched by any SDD task. Minor note carried to final review: an in-flight submitConfirmed request could still resolve after modal close and leave a stale 'result' phase on reopen (pre-existing, not introduced by the fix).

ALL 10 TASKS COMPLETE. Proceeding to final whole-branch review.

## Final whole-branch review (commits a6ebe0d..e4d38ac, most capable model)
Ready to merge: With fixes. No Critical findings. Found 1 Important (abandoned staged CVs on modal-close leaked both the Mongo doc and on-disk PII file with no cleanup path) and 5 Minor (dead "Back" button in review phase, stale submit-result could surface after modal close mid-submit, discard endpoint missing department scoping for chef_departement, an inert generation-counter bump, pytest-asyncio not pinned in requirements.txt).

## Fix round 1 (commits 057571f, 2725be0, 0bc9ade)
Fixed all 6 findings. Re-verification found the two frontend guard-related fixes were each real but incomplete:
- Abandon-cleanup only protected the *first* submitConfirmed() call from deletion (via `submitInFlight = submitTriggeredRef.current && !submitResult`), not a retry — since `submitResult` is already non-null by the time a retry runs, a staged CV could get deleted while a retry's confirm was still in flight.
- The new `abandonedRef` was a shared boolean, not a generation token — an orphaned first submit resolving late (after a legitimate second submit reset the boolean for its own benefit) could clobber the second submit's real result on screen. Same bug class as the Task 8 saga; this file already has the correct pattern (`runGenerationRef`) elsewhere and didn't apply it here.

## Fix round 2 (commits e6a4635, 9196985)
- Replaced the submitInFlight check with an explicit `inFlightStagedIdsRef` Set, populated per-request (both submitConfirmed and retryFailedSubmissions) right before the fetch fires and cleared in `finally` — resetAndClose's cleanup now protects any item currently in that set regardless of which call put it there.
- Replaced `abandonedRef` (boolean) with `submitGenerationRef` (monotonic token), mirroring `runGenerationRef`'s already-proven pattern — each submit/retry call captures its own token and only writes state if it's still current at resolution.
- Added a backend test for chef_departement department-scoping on the discard endpoint (couldn't run live — local MongoDB container is down due to an unrelated image/volume version mismatch from the user's own separate concurrent Docker work, not a code issue).

Final re-verification: both fixes traced closed with no gaps (including a 3-generations-deep composition check), backend test confirmed correct by code reading. **Ready to merge: Yes.**

Mid-session, the user reported CV parsing was returning fake data while manually testing — root cause: `backend/.env`'s FAKE_ANALYSIS had been left at 1 from earlier testing across this whole session; fixed to 0. A repo hook now blocks direct `.env` edits going forward (use `.env.docker.example` instead going forward).

Known outstanding gap (infra, not code): local MongoDB container is currently down (`mongo:7` image vs. an existing volume created with a newer `featureCompatibilityVersion`, from the user's own separate Docker rework in progress) — the new chef_departement discard test has only been collect-verified, not run live. Recommend the user run the full backend suite once their Docker environment is sorted, before or shortly after merging.

ALL WORK COMPLETE. Branch ready for finishing-a-development-branch.

<!-- Prior ledger (Account Email Verification, dev_feature_2) completed and
     merged; removed here to avoid confusion with this plan. -->
