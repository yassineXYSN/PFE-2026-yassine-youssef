# Manual Candidate CV Upload (HR Job Page)

**Date:** 2026-07-20
**Status:** Approved for planning

## Problem

On the HR Job Detail page (`frontend/src/apps/HR/jobs/detail/JobDetail.jsx`), HR can currently
only see candidates who applied through the platform themselves. There is no way for HR to add
candidates they've sourced elsewhere (referrals, job boards, walk-in CVs, etc.) so that those
candidates go through the same AI screening/matching pipeline as regular applicants.

## Goal

Let HR drop multiple CV files (PDF/DOC/DOCX) on the Job Detail page. Each CV is parsed by the
same AI CV-extraction engine already used during candidate self-onboarding. HR reviews the
extracted profile side-by-side with the original CV, one candidate at a time, and can edit fields
before confirming. Once confirmed, each candidate becomes a normal `candidates` + `job_applications`
record for that job — indistinguishable, from the AI-matching pipeline's point of view, from a
candidate who applied on their own. No new analysis code is needed: the existing "Analyser" button
on Job Detail (`GET /ai-matching/applicant-scores/{job_id}`) already scores every application tied
to a job, regardless of how it was created.

## Non-goals

- No login/account is created for manually-added candidates. They are profile records only
  (`user_id` is a synthetic identifier, never a real auth account).
- No duplicate-detection/merge logic across candidates — out of scope for v1.
- No new background-job/task-queue infrastructure. The codebase has no existing async job queue;
  long-running work (parsing N CVs) is handled by the frontend orchestrating multiple short,
  isolated backend calls with client-side progress tracking. This matches the only comparable
  precedent in the repo (`quiz.py`'s `/upload-document`, which is also fully synchronous per file).
- No inline preview rendering for DOC/DOCX (no library for that exists in this codebase yet) — the
  review screen shows a file card with name/size and a download link for those types; PDFs get a
  live inline preview via `<iframe>`.

## Existing flow this builds on

- **Candidate self-onboarding CV parse**: `POST /candidat/account-setup/parse-cv`
  (`backend/routes/candidat/account_setup.py`) accepts a PDF, extracts text
  (`utils/cv_parser.extract_text_from_pdf`), and runs it through
  `utils/account_analysis.parse_cv`, which calls the LLM and validates the result against the
  `AccountSetupData` pydantic model (`database/model.py`). The frontend wizard step
  (`frontend/src/apps/Candidat/AccountSetup/steps/Step1/Step1.jsx`) is the reference for "parse
  then let the user correct fields" UX, though its multi-step wizard shape is more than this
  feature needs.
- **Application creation**: `POST /applications/apply` (`backend/routers/applications.py`) shows
  the canonical shape of a `job_applications` document (`candidate_id`, `job_id`, `status: "new"`,
  `profile_snapshot`, `applied_at`).
- **AI scoring**: `GET /ai-matching/applicant-scores/{job_id}` (`backend/routers/ai_matching.py`)
  scores every `job_applications` row for a job. This is unchanged by this feature — it is the
  mechanism that gives manually-added candidates the "analysed like the ones that come normally"
  behavior for free.
- **Precedent for HR-created synthetic candidates**: `backend/routers/test_pipeline.py` already
  inserts synthetic `candidates` docs with a fabricated `user_id` (`test-user-{ObjectId()}`) and
  matching `job_applications` docs, then runs them through the automation funnel. This feature
  follows the same shape, using a `manual-{ObjectId()}` prefix instead, plus a `source: "hr_manual"`
  marker on both documents for traceability.
- **DOCX text extraction**: `backend/services/quiz/ingestion.py` already has
  `extract_text_from_docx(file_bytes) -> Tuple[str, int]`, used for quiz source documents. This
  feature reuses it for CVs instead of writing a new DOCX parser.

## Backend design

### `utils/account_analysis.py` — shared parser, PDF + DOCX

Add `parse_cv_bytes(file_bytes: bytes, filename: str) -> dict`:
- Dispatches on file extension:
  - `.pdf` → write to a temp file, reuse existing `utils/cv_parser.extract_text_from_pdf`.
  - `.doc` / `.docx` → reuse `services/quiz/ingestion.extract_text_from_docx`.
- From there, shares the existing `clean_text` → `build_messages` → LLM call →
  `_validate_and_correct` pipeline unchanged.
- The existing `parse_cv(pdf_path)` function stays as-is (still used by anything that already
  has a PDF path); `parse_cv_bytes` is the new bytes-based entry point both the candidate endpoint
  and the new HR endpoint call.

`/candidat/account-setup/parse-cv` (`backend/routes/candidat/account_setup.py`) is updated to
accept `.doc`/`.docx` in addition to `.pdf` and call `parse_cv_bytes`, extending DOC/DOCX support
to the regular candidate self-onboarding flow as well.

### New router: `backend/routers/manual_candidates.py`

Mounted at `/api/manual-candidates`, gated to `HR_SIDE_ROLES` (same set used in
`routers/candidates.py`), with job company-scoping checks matching the pattern in
`routers/applications.py::get_applications_for_job`.

New collection: `hr_manual_cv_staging`
```
{
  _id, job_id, uploaded_by (hr user id), company_id,
  filename, content_type, size, file_path,
  status: "staged" | "confirmed" | "discarded",
  parsed_profile: {...AccountSetupData-shaped dict...},
  created_at, updated_at
}
```

**`POST /manual-candidates/parse`** — multipart, one file (`cv`) + `job_id` field.
1. Validate job exists and belongs to caller's company (403/404 otherwise).
2. Validate extension/size (reuse `utils/uploads.validate_upload`, `DOC_EXTS`, `MAX_DOC_BYTES`).
3. Save the file to `static/uploads` (reuse the `_save_upload` pattern from
   `account_setup.py`) — saved immediately so it never needs re-uploading later.
4. Call `parse_cv_bytes`.
5. Insert the staging doc (`status: "staged"`) and return
   `{staged_id, filename, content_type, size, parsed: {...}}`.
6. Errors (parse failure, corrupt file, LLM error) return a 4xx/5xx with a clear `detail` message;
   the staging doc is still written with a partial/empty `parsed_profile` and no candidate is
   created — this call is isolated per file so one bad CV never affects the others.

**`DELETE /manual-candidates/staged/{staged_id}`** — best-effort: deletes the stored file and the
staging doc (or marks `status: "discarded"` if deletion fails), used when HR discards a candidate
during review. Ownership check: `uploaded_by == current_user.id` or same-company HR.

**`POST /manual-candidates/confirm`** — body `{job_id, candidates: [{staged_id, profile}]}` where
`profile` is the (possibly HR-edited) parsed data for that candidate.
For each item, independently (partial failures don't abort the batch):
1. Look up the staging doc by `staged_id`; verify `status == "staged"` and it belongs to `job_id`.
2. Build a `candidates` document: `user_id = f"manual-{ObjectId()}"`, `source: "hr_manual"`,
   `added_by: current_user.id`, `company_id`, `cv: {filename, content_type, size, file_path}`
   (from the staging doc — no re-upload), plus the (edited) profile fields
   (`firstName`, `lastName`, `title`, `email`, `skills`, `experiences`, `educations`,
   `certificates`, `languages`, etc.), `created_at`/`updated_at`. Insert into `candidates`.
3. Build a `job_applications` document matching the shape from `POST /applications/apply`:
   `candidate_id` = the synthetic `user_id`, `job_id`, `status: "new"`, `source: "hr_manual"`,
   `profile_snapshot` (same whitelist of fields used in `apply_to_job`), `applied_at: now`.
   Insert into `job_applications`.
4. Best-effort call `AIMatchingService.vectorize_and_save_profile` (same call made at the end of
   `account_setup.py`) so the candidate is embedding-searchable like a normal one; failure here is
   logged, not fatal (mirrors the existing try/except in `account_setup.py`).
5. Mark the staging doc `status: "confirmed"`.
6. Collect `{staged_id, candidate_id, application_id}` on success, or `{staged_id, error}` on
   failure.

Response: `{created: [...], failed: [...]}` — always returned even if some items failed, so the
frontend can show a precise per-candidate result and let HR retry just the failed ones.

## Frontend design

### Entry point

New button "Ajouter des candidats" in `JobDetail.jsx`'s `.hjd-right-head`, next to the existing
`hjd-analyze-btn`. Opens a new modal component:
`frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx` (+ `.css`).

### Phase 1 — Drop zone

Multi-file drag-and-drop + browse, accepting `.pdf,.doc,.docx`, no file-count cap. Client-side
validates extension/size before upload (mirrors `TestPipeline.jsx`'s dropzone pattern). Files
queue up in local React state as `{file: File, status: 'queued'}`.

### Phase 2 — Parsing (backend calls, client-orchestrated)

- Processes the queue with a concurrency cap of 3 (matches `AI_MATCHING_MAX_CONCURRENT` used
  server-side in `ai_matching.py`, keeping LLM load consistent with the rest of the app).
- Each file: `POST /manual-candidates/parse`. On success, store `{staged_id, parsed, file}` (the
  original `File` is kept in memory for local preview — no need to fetch it back from the server).
  On failure, mark that entry `status: 'failed'` with the error message and a retry action; move on
  to the next queued file — one failure never blocks the rest.
- Progress bar: `parsed_count / total` as a percentage, live-updating as each call resolves.
- If several calls in a row fail (heuristic: e.g. 3 consecutive network-level failures), treat it
  as a connectivity/server problem: pause the queue, show a banner ("Connexion interrompue —
  réessayer"), and let HR resume — nothing already parsed is lost since all progress lives in
  client state, not a server-side job.
- "Continuer" becomes available once at least one file has parsed successfully, moving to Phase 3
  with whichever files succeeded; failed files remain visible with a retry option the HR can use
  before or after moving on.

### Phase 3 — Review (one candidate at a time)

Carousel over successfully-parsed entries ("Candidat 3 / 9"). Each screen:
- **Left**: editable form — first/last name, title, email, phone, birth date, address, LinkedIn,
  skills, experiences, educations, certificates, languages. Reuses existing form building blocks
  from `frontend/src/apps/Candidat/Dashboard/Profile/components/*` where their prop shape fits;
  otherwise a lightweight bespoke form scoped to this modal (decided at implementation time based
  on how cleanly those components decouple from the candidate dashboard context).
- **Right**: CV preview. PDF → `<iframe src={URL.createObjectURL(file)}>` (same technique as
  `CVViewerModal.jsx`, but from the local `File` object instead of a fetched blob). DOC/DOCX → a
  file card (name, size, icon) with a "download to view" link, since no in-browser DOCX renderer
  exists in this codebase.
- Actions: **Discard** (calls `DELETE /manual-candidates/staged/{staged_id}`, removes from list,
  advances), **Confirm & Next** (pushes the current — possibly edited — profile into a local
  "confirmed" queue, advances), **Back** (previous candidate, edits preserved).

### Phase 4 — Submit + Result

Once HR has stepped through all candidates (or chosen to submit early), a single
`POST /manual-candidates/confirm` call submits the whole "confirmed" queue at once. Shows a
spinner (this call is fast — no LLM work happens here). Result screen lists successes and
failures separately; failed items get a "Réessayer" that re-sends just those. Closing the modal
re-fetches `/applications/job/{id}` on `JobDetail.jsx` so newly-added candidates appear immediately
in the candidates table, ready for the existing "Analyser" action.

### i18n

New keys added to `frontend/src/apps/HR/translations.js`, following the existing
`hr-job-detail-*` naming convention (e.g. `hr-job-detail-manual-add-btn`,
`hr-job-detail-manual-drop-hint`, etc.).

## Error handling summary

| Failure point | Behavior |
|---|---|
| One CV fails to parse | Marked failed inline, rest of batch continues, retry available |
| Repeated/network-level failures | Batch pauses, banner shown, resumable — no state lost |
| One candidate fails at confirm time | Reported individually in the `failed` list, others still created, retry available |
| HR discards a candidate mid-review | Staged file cleaned up server-side, batch continues |

## Testing

- **Backend (pytest)**: `parse_cv_bytes` dispatch (PDF vs DOCX path), `/manual-candidates/parse`
  and `/confirm` endpoints using the existing `fake_analysis_enabled()` mock-LLM toggle (already
  used in `utils/account_analysis.parse_cv` — same trick avoids real LLM calls in tests),
  authorization/company-scoping checks (non-HR role rejected, cross-company job rejected),
  partial-failure behavior of `/confirm` (one bad `staged_id` doesn't fail the others).
- **Manual verification**: drive the full drop → parse → review-and-edit → confirm flow in the
  browser against a real job, confirm the new applications appear in the Job Detail table and get
  scored correctly by the existing "Analyser" button, per this repo's `verify` skill convention.
