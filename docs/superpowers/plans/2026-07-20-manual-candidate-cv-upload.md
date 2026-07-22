# Manual Candidate CV Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR bulk-drop CVs (PDF/DOC/DOCX) on the Job Detail page, review each AI-parsed profile side-by-side with its CV, and confirm to create normal `candidates` + `job_applications` records that flow through the existing AI-matching pipeline unchanged.

**Architecture:** Backend adds a bytes-based CV parser shared with the candidate self-onboarding flow, plus a new `manual_candidates` router with three endpoints (`parse` one file at a time, `staged` delete for discards, `confirm` batch-create). Frontend adds a modal on `JobDetail.jsx` that client-orchestrates the parse calls (bounded concurrency, per-file error isolation, live progress) and walks HR through a one-at-a-time review-and-edit screen before a single batch confirm call.

**Tech Stack:** FastAPI + Motor (async MongoDB) on the backend, React 19 (no test framework — manual browser verification) on the frontend. Reuses `utils/cv_parser.extract_text_from_pdf`, `services/quiz/ingestion.extract_text_from_docx`, `utils/uploads.validate_upload`, `utils/files.get_upload_dir`/`get_backend_root`, and `services/ai_matching.AIMatchingService`.

## Global Constraints

- Manually-added candidates are profile records only — never real login accounts. `user_id` is a synthetic `manual-<ObjectId>` string.
- Accept PDF, DOC, and DOCX for both the new HR bulk flow and (per user request) the existing candidate self-onboarding parse endpoint.
- No cap on number of CVs per batch.
- One CV's parse/confirm failure must never block the rest of the batch — isolate failures per item and report them individually.
- No new background-job/task-queue infrastructure — the frontend orchestrates multiple short backend calls with client-side progress and concurrency (cap: 3 concurrent, matching `AI_MATCHING_MAX_CONCURRENT`'s existing precedent in `ai_matching.py`).
- New CSS classes must use the `mcm-` prefix (Manual Candidates Modal) to avoid collisions flagged by `npm run check:css-collisions`.
- Frontend has no test framework — verify via `npm run lint`, `npm run build`, and manual browser testing per this repo's `verify` skill convention.
- Backend tests hit a real MongoDB (via `MONGODB_URL` in `backend/.env`, same as existing integration tests) and must clean up everything they insert.

---

## Task 1: Shared bytes-based CV parser (PDF + DOCX)

**Files:**
- Modify: `backend/utils/account_analysis.py`
- Test: `backend/tests/test_account_analysis_parse_cv_bytes.py`

**Interfaces:**
- Produces: `async def parse_cv_bytes(file_bytes: bytes, filename: str) -> dict[str, Any]` in `utils/account_analysis.py` — used by Task 2 (candidate endpoint) and Task 3 (HR manual-candidates endpoint). Raises `ValueError` for unsupported extensions, propagates any parsing/LLM error.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_account_analysis_parse_cv_bytes.py`:

```python
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.account_analysis import parse_cv_bytes


@pytest.mark.asyncio
async def test_parse_cv_bytes_fake_mode_pdf(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    result = await parse_cv_bytes(b"%PDF-1.4 not a real pdf", "resume.pdf")
    assert result["title"].startswith("[FAKE]")
    assert isinstance(result["skills"], list)


@pytest.mark.asyncio
async def test_parse_cv_bytes_fake_mode_docx(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    result = await parse_cv_bytes(b"not a real docx either", "resume.docx")
    assert result["title"].startswith("[FAKE]")


@pytest.mark.asyncio
async def test_parse_cv_bytes_rejects_unsupported_extension(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    with pytest.raises(ValueError):
        await parse_cv_bytes(b"whatever", "resume.txt")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_account_analysis_parse_cv_bytes.py -v`
Expected: FAIL with `ImportError: cannot import name 'parse_cv_bytes'`

- [ ] **Step 3: Refactor `parse_cv` and add `parse_cv_bytes`**

In `backend/utils/account_analysis.py`, add `import os` to the top-level imports (after `import json`):

```python
import json
import logging
import os
from typing import Any
```

Replace the existing `parse_cv` function (the block starting at `async def parse_cv(pdf_path: str) -> dict[str, Any]:` through its final `return result`) with:

```python
async def _parse_cv_raw_text(raw_text: str) -> dict[str, Any]:
    cleaned = clean_text(raw_text)
    logger.info("Cleaned text: %s characters.", f"{len(cleaned):,}")

    max_chars = 128_000
    if len(cleaned) > max_chars:
        logger.warning("Text too long, truncating to %s chars.", f"{max_chars:,}")
        cleaned = cleaned[:max_chars]

    messages = build_messages(cleaned)
    raw_output = await _generate_account_json(messages)
    raw_data = extract_json_from_response(raw_output)
    result = await _validate_and_correct(raw_data, messages)
    logger.info("Account analysis completed successfully.")
    return result


def _fake_account_analysis_result() -> dict[str, Any]:
    mock_data = json.loads(json.dumps(EXAMPLE_JSON))
    mock_data["title"] = f"[FAKE] {mock_data['title']}"
    return mock_data


async def parse_cv(pdf_path: str) -> dict[str, Any]:
    logger.info("=" * 60)
    logger.info("Account Analysis Engine - %s", pdf_path)
    logger.info("=" * 60)

    if fake_analysis_enabled() or get_account_analysis_settings().is_mock:
        logger.info("[FAKE ANALYSIS] Mode enabled. Returning mock account analysis data.")
        return _fake_account_analysis_result()

    raw_text = extract_text_from_pdf(pdf_path)
    logger.info("Extracted %s characters from PDF.", f"{len(raw_text):,}")
    return await _parse_cv_raw_text(raw_text)


async def parse_cv_bytes(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """Parse a CV from raw bytes, dispatching on file extension.

    Supports .pdf (via PyMuPDF) and .doc/.docx (via python-docx, reusing the
    quiz-document ingestion extractor). Legacy binary .doc files are accepted
    for the upload but python-docx can only read them if they're actually
    OOXML underneath — same limitation the quiz document ingester already has.
    """
    logger.info("=" * 60)
    logger.info("Account Analysis Engine (bytes) - %s", filename)
    logger.info("=" * 60)

    if fake_analysis_enabled() or get_account_analysis_settings().is_mock:
        logger.info("[FAKE ANALYSIS] Mode enabled. Returning mock account analysis data.")
        return _fake_account_analysis_result()

    ext = os.path.splitext(filename or "")[1].lower()
    if ext == ".pdf":
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        try:
            raw_text = extract_text_from_pdf(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    elif ext in (".doc", ".docx"):
        from services.quiz.ingestion import extract_text_from_docx

        raw_text, _ = extract_text_from_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported CV file type: {ext or '(none)'}")

    logger.info("Extracted %s characters from %s.", f"{len(raw_text):,}", ext)
    return await _parse_cv_raw_text(raw_text)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_account_analysis_parse_cv_bytes.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/utils/account_analysis.py backend/tests/test_account_analysis_parse_cv_bytes.py
git commit -m "feat(backend): add bytes-based CV parser supporting PDF + DOCX"
```

---

## Task 2: DOC/DOCX support in candidate self-onboarding parse-cv endpoint

**Files:**
- Modify: `backend/routes/candidat/account_setup.py`
- Test: `backend/tests/test_account_setup_parse_cv_endpoint.py`

**Interfaces:**
- Consumes: `parse_cv_bytes(file_bytes: bytes, filename: str) -> dict` from Task 1.
- Produces: no new interface — `POST /api/candidat/account-setup/parse-cv` now accepts `.pdf`, `.doc`, `.docx`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_account_setup_parse_cv_endpoint.py`:

```python
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_parse_cv_rejects_unsupported_extension(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    files = {"cv": ("resume.txt", b"hello", "text/plain")}
    r = client.post(
        "/api/candidat/account-setup/parse-cv",
        files=files,
        headers={"Authorization": "Bearer fake"},
    )
    assert r.status_code in (400, 401)


def test_parse_cv_accepts_docx(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    try:
        import docx

        doc = docx.Document()
        doc.add_paragraph("John Doe - Senior Engineer")
        import io

        buf = io.BytesIO()
        doc.save(buf)
        buf.seek(0)
        docx_bytes = buf.read()
    except ImportError:
        import pytest

        pytest.skip("python-docx not installed")

    files = {"cv": ("resume.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    r = client.post("/api/candidat/account-setup/parse-cv", files=files)
    # Auth will reject without a real token; this test only proves the
    # extension is no longer rejected before the auth check runs.
    assert r.status_code != 400 or "Only PDF" not in r.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_account_setup_parse_cv_endpoint.py -v`
Expected: `test_parse_cv_accepts_docx` FAILs (current code returns 400 "Only PDF files are supported for parsing." before reaching auth)

- [ ] **Step 3: Update the endpoint**

In `backend/routes/candidat/account_setup.py`, change the import line:

```python
from utils.account_analysis import parse_cv
```

to:

```python
from utils.account_analysis import parse_cv, parse_cv_bytes
```

Replace the entire `parse_cv_endpoint` function body with:

```python
_PARSE_CV_ALLOWED_EXTS = (".pdf", ".doc", ".docx")


@router.post("/account-setup/parse-cv", tags=["candidat"])
async def parse_cv_endpoint(
    cv: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """
    Parse a CV file (PDF, DOC, or DOCX) and return the extracted JSON data
    matching AccountSetupData.
    """
    # 1. Authenticate
    try:
        user_id = get_user_id_from_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {e}")

    # 2. Check file extension
    filename = cv.filename or ""
    ext = os.path.splitext(filename.lower())[1]
    if ext not in _PARSE_CV_ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Only PDF, DOC, or DOCX files are supported for parsing.")

    # 3. Parse CV directly from bytes
    content = await cv.read()
    try:
        result = await parse_cv_bytes(content, filename)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"CV Parsing failed: {str(e)}")
```

Remove the now-unused `import tempfile` line from the top of the file (the temp-file handling moved into `parse_cv_bytes` in Task 1; `os` stays imported since `_save_upload`/`UPLOAD_DIR` still use it).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_account_setup_parse_cv_endpoint.py -v`
Expected: 2 passed (or 1 passed + 1 skipped if `python-docx` isn't installed — check `pip show python-docx` in `backend/venv` first; it's already a dependency of `services/quiz/ingestion.py` so it should be present)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/candidat/account_setup.py backend/tests/test_account_setup_parse_cv_endpoint.py
git commit -m "feat(backend): accept DOC/DOCX in candidate self-onboarding CV parser"
```

---

## Task 3: `manual_candidates` router — POST /parse

**Files:**
- Create: `backend/routers/manual_candidates.py`
- Modify: `backend/main.py`
- Test: `backend/tests/test_manual_candidates.py`

**Interfaces:**
- Consumes: `parse_cv_bytes` (Task 1), `HR_SIDE_ROLES` from `routers/candidates.py`, `require_roles`/`get_current_user` from `middleware/auth.py`, `get_async_db` from `database/mongodb_async.py`, `validate_upload`/`DOC_EXTS`/`MAX_DOC_BYTES` from `utils/uploads.py`, `get_upload_dir` from `utils/files.py`.
- Produces:
  - `POST /api/manual-candidates/parse` (multipart: `job_id` form field + `cv` file) → `{staged_id: str, filename: str, content_type: str, size: int, parsed: dict}`.
  - Mongo collection `hr_manual_cv_staging` with shape `{_id, job_id, company_id, uploaded_by, filename, content_type, size, file_path, status: "staged"|"confirmed", parsed_profile, created_at, updated_at}` — consumed by Task 4 (delete) and Task 5 (confirm).
  - `_ensure_job_access(db, job_id, current_user) -> dict` (raises `HTTPException` 400/403/404) — reused by Task 4 and Task 5.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_manual_candidates.py`:

```python
import io
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bson import ObjectId
from fastapi.testclient import TestClient

from main import app
from middleware.auth import get_current_user
from database.mongodb import connect_mongodb

client = TestClient(app)


def _db():
    return connect_mongodb()["HumatiQ"]


def _as(role, company_id="company-1"):
    return lambda: {"id": "hr-1", "email": "hr@x.io", "role": role,
                     "company_id": company_id, "department_id": None}


def _make_job(company_id="company-1"):
    db = _db()
    job_id = ObjectId()
    db.hr_jobs.insert_one({
        "_id": job_id,
        "title": "Backend Engineer",
        "company_id": company_id,
        "department_id": None,
        "created_at": datetime.utcnow(),
    })
    return str(job_id)


def _cleanup_job(job_id):
    db = _db()
    db.hr_jobs.delete_one({"_id": ObjectId(job_id)})
    db.hr_manual_cv_staging.delete_many({"job_id": job_id})
    db.candidates.delete_many({"company_id": "company-1", "source": "hr_manual"})
    db.job_applications.delete_many({"job_id": job_id})


def test_parse_rejects_non_hr_role(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    job_id = _make_job()
    try:
        app.dependency_overrides[get_current_user] = _as("candidat")
        files = {"cv": ("resume.pdf", b"%PDF fake", "application/pdf")}
        r = client.post("/api/manual-candidates/parse", data={"job_id": job_id}, files=files)
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)


def test_parse_rejects_job_from_other_company(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    job_id = _make_job(company_id="company-2")
    try:
        app.dependency_overrides[get_current_user] = _as("hr", company_id="company-1")
        files = {"cv": ("resume.pdf", b"%PDF fake", "application/pdf")}
        r = client.post("/api/manual-candidates/parse", data={"job_id": job_id}, files=files)
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)


def test_parse_happy_path_creates_staging_doc(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    job_id = _make_job()
    try:
        app.dependency_overrides[get_current_user] = _as("hr")
        files = {"cv": ("resume.pdf", b"%PDF fake resume content", "application/pdf")}
        r = client.post("/api/manual-candidates/parse", data={"job_id": job_id}, files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["filename"] == "resume.pdf"
        assert body["parsed"]["title"].startswith("[FAKE]")
        staged_id = body["staged_id"]
        assert ObjectId.is_valid(staged_id)

        db = _db()
        staged = db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)})
        assert staged is not None
        assert staged["status"] == "staged"
        assert staged["job_id"] == job_id
        assert os.path.isfile(os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            staged["file_path"].replace("/", os.sep),
        ))
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v`
Expected: FAIL with 404 (route doesn't exist yet) on all three tests

- [ ] **Step 3: Create the router**

Create `backend/routers/manual_candidates.py`:

```python
import os
import secrets
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from database.mongodb_async import get_async_db
from middleware.auth import require_roles
from routers.candidates import HR_SIDE_ROLES
from utils.account_analysis import parse_cv_bytes
from utils.files import get_backend_root, get_upload_dir
from utils.uploads import DOC_EXTS, MAX_DOC_BYTES, validate_upload

router = APIRouter(prefix="/manual-candidates", tags=["HR Manual Candidates"])


async def _ensure_job_access(db, job_id: str, current_user: dict) -> dict:
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job_id")
    job = await db.hr_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    role = current_user.get("role")
    if role != "superadmin":
        if job.get("company_id") != current_user.get("company_id"):
            raise HTTPException(status_code=403, detail="Not authorized to access this job")
        if role == "chef_departement" and job.get("department_id") != current_user.get("department_id"):
            raise HTTPException(status_code=403, detail="Not authorized to access this job")
    return job


def _save_cv_upload(file_bytes: bytes, original_filename: str, prefix: str) -> tuple[str, str]:
    """Validate then save CV bytes under static/uploads. Returns (relative_path, ext)."""
    ext = validate_upload(original_filename, file_bytes, allowed_exts=DOC_EXTS, max_bytes=MAX_DOC_BYTES)
    upload_dir = get_upload_dir()
    disk_name = f"{prefix}_{secrets.token_hex(8)}{ext}"
    abs_path = os.path.join(upload_dir, disk_name)
    with open(abs_path, "wb") as f:
        f.write(file_bytes)
    return f"static/uploads/{disk_name}", ext


def _delete_staged_file(file_path: Optional[str]) -> None:
    if not file_path:
        return
    abs_path = os.path.join(get_backend_root(), file_path.replace("/", os.sep))
    try:
        if os.path.isfile(abs_path):
            os.remove(abs_path)
    except OSError:
        pass


@router.post("/parse")
async def parse_manual_candidate_cv(
    job_id: str = Form(...),
    cv: UploadFile = File(...),
    current_user: dict = Depends(require_roles(HR_SIDE_ROLES)),
):
    """
    Parse a single CV for a manually-added candidate. Saves the file to disk
    immediately (so it never needs re-uploading at confirm time), stages a
    record in ``hr_manual_cv_staging``, and returns the parsed profile for
    HR to review/edit before confirming.
    """
    db = get_async_db()
    job = await _ensure_job_access(db, job_id, current_user)

    filename = cv.filename or "cv"
    file_bytes = await cv.read()

    file_path, _ext = _save_cv_upload(file_bytes, filename, prefix=f"manualcv_{current_user['id']}")

    now = datetime.utcnow()
    staging_doc = {
        "job_id": job_id,
        "company_id": job.get("company_id"),
        "uploaded_by": current_user["id"],
        "filename": filename,
        "content_type": cv.content_type or "application/octet-stream",
        "size": len(file_bytes),
        "file_path": file_path,
        "status": "staged",
        "parsed_profile": None,
        "created_at": now,
        "updated_at": now,
    }
    insert_result = await db.hr_manual_cv_staging.insert_one(staging_doc)

    try:
        parsed = await parse_cv_bytes(file_bytes, filename)
    except Exception as e:
        _delete_staged_file(file_path)
        await db.hr_manual_cv_staging.delete_one({"_id": insert_result.inserted_id})
        raise HTTPException(status_code=500, detail=f"CV Parsing failed: {str(e)}")

    await db.hr_manual_cv_staging.update_one(
        {"_id": insert_result.inserted_id},
        {"$set": {"parsed_profile": parsed, "updated_at": datetime.utcnow()}},
    )

    return {
        "staged_id": str(insert_result.inserted_id),
        "filename": filename,
        "content_type": staging_doc["content_type"],
        "size": staging_doc["size"],
        "parsed": parsed,
    }
```

In `backend/main.py`, update the multi-line `from routers import (...)` block (lines 11-15):

```python
from routers import (
    profiles, companies, departments, jobs, stats,
    candidates, ai_matching, applications, saved_jobs,
    interviews, external_auth, notifications, parametrage, team
)
```

to:

```python
from routers import (
    profiles, companies, departments, jobs, stats,
    candidates, ai_matching, applications, saved_jobs,
    interviews, external_auth, notifications, parametrage, team,
    manual_candidates
)
```

Then add the registration line right after `app.include_router(candidates.router, prefix="/api")` (main.py:167):

```python
app.include_router(candidates.router, prefix="/api")
app.include_router(manual_candidates.router, prefix="/api")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/routers/manual_candidates.py backend/main.py backend/tests/test_manual_candidates.py
git commit -m "feat(backend): add POST /manual-candidates/parse endpoint"
```

---

## Task 4: `manual_candidates` router — DELETE /staged/{staged_id}

**Files:**
- Modify: `backend/routers/manual_candidates.py`
- Test: `backend/tests/test_manual_candidates.py`

**Interfaces:**
- Consumes: `_ensure_job_access`, `_delete_staged_file` from Task 3.
- Produces: `DELETE /api/manual-candidates/staged/{staged_id}` → `{ok: true}` or `{ok: true, already_removed: true}`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_manual_candidates.py`:

```python
def test_discard_staged_removes_file_and_doc(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    job_id = _make_job()
    try:
        app.dependency_overrides[get_current_user] = _as("hr")
        files = {"cv": ("resume.pdf", b"%PDF fake resume content", "application/pdf")}
        r = client.post("/api/manual-candidates/parse", data={"job_id": job_id}, files=files)
        staged_id = r.json()["staged_id"]

        db = _db()
        staged = db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)})
        abs_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            staged["file_path"].replace("/", os.sep),
        )
        assert os.path.isfile(abs_path)

        del_r = client.delete(f"/api/manual-candidates/staged/{staged_id}")
        assert del_r.status_code == 200
        assert del_r.json()["ok"] is True
        assert db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)}) is None
        assert not os.path.isfile(abs_path)

        # Deleting again is a safe no-op
        del_r2 = client.delete(f"/api/manual-candidates/staged/{staged_id}")
        assert del_r2.status_code == 200
        assert del_r2.json().get("already_removed") is True
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py::test_discard_staged_removes_file_and_doc -v`
Expected: FAIL with 404 (route doesn't exist)

- [ ] **Step 3: Add the endpoint**

In `backend/routers/manual_candidates.py`, append after `parse_manual_candidate_cv`:

```python
@router.delete("/staged/{staged_id}")
async def discard_staged_manual_candidate(
    staged_id: str,
    current_user: dict = Depends(require_roles(HR_SIDE_ROLES)),
):
    """Best-effort cleanup when HR discards a candidate during review."""
    if not ObjectId.is_valid(staged_id):
        raise HTTPException(status_code=400, detail="Invalid staged_id")

    db = get_async_db()
    staged = await db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)})
    if not staged:
        return {"ok": True, "already_removed": True}

    if current_user.get("role") != "superadmin" and staged.get("company_id") != current_user.get("company_id"):
        raise HTTPException(status_code=403, detail="Not authorized to discard this staged CV")

    _delete_staged_file(staged.get("file_path"))
    await db.hr_manual_cv_staging.delete_one({"_id": ObjectId(staged_id)})
    return {"ok": True}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/routers/manual_candidates.py backend/tests/test_manual_candidates.py
git commit -m "feat(backend): add DELETE /manual-candidates/staged/{id} endpoint"
```

---

## Task 5: `manual_candidates` router — POST /confirm

**Files:**
- Modify: `backend/routers/manual_candidates.py`
- Test: `backend/tests/test_manual_candidates.py`

**Interfaces:**
- Consumes: `_ensure_job_access` (Task 3), `Hobby`/`Skill`/`Language`/`Education`/`Experience`/`Certificate`/`JobPreferences` from `database/model.py`, `AIMatchingService` from `services/ai_matching.py`.
- Produces: `POST /api/manual-candidates/confirm` (body `{job_id, candidates: [{staged_id, profile}]}`) → `{created: [{staged_id, candidate_id, application_id}], failed: [{staged_id, error}]}`. Writes `candidates` docs with `user_id: "manual-<ObjectId>"`, `source: "hr_manual"`, and matching `job_applications` docs with `status: "new"`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_manual_candidates.py`:

```python
def test_confirm_creates_candidate_and_application(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    job_id = _make_job()
    try:
        app.dependency_overrides[get_current_user] = _as("hr")
        files = {"cv": ("resume.pdf", b"%PDF fake resume content", "application/pdf")}
        parse_r = client.post("/api/manual-candidates/parse", data={"job_id": job_id}, files=files)
        staged_id = parse_r.json()["staged_id"]
        parsed_profile = parse_r.json()["parsed"]
        parsed_profile["email"] = "jane.doe@example.com"
        parsed_profile["firstName"] = "Jane"
        parsed_profile["lastName"] = "Doe"

        confirm_r = client.post("/api/manual-candidates/confirm", json={
            "job_id": job_id,
            "candidates": [{"staged_id": staged_id, "profile": parsed_profile}],
        })
        assert confirm_r.status_code == 200, confirm_r.text
        body = confirm_r.json()
        assert len(body["created"]) == 1
        assert body["failed"] == []

        candidate_id = body["created"][0]["candidate_id"]
        application_id = body["created"][0]["application_id"]

        db = _db()
        candidate = db.candidates.find_one({"_id": ObjectId(candidate_id)})
        assert candidate["user_id"].startswith("manual-")
        assert candidate["source"] == "hr_manual"
        assert candidate["email"] == "jane.doe@example.com"
        assert candidate["firstName"] == "Jane"

        application = db.job_applications.find_one({"_id": ObjectId(application_id)})
        assert application["job_id"] == job_id
        assert application["status"] == "new"
        assert application["candidate_id"] == candidate["user_id"]

        staged = db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)})
        assert staged["status"] == "confirmed"
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)


def test_confirm_reports_partial_failure(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    job_id = _make_job()
    try:
        app.dependency_overrides[get_current_user] = _as("hr")
        confirm_r = client.post("/api/manual-candidates/confirm", json={
            "job_id": job_id,
            "candidates": [{"staged_id": str(ObjectId()), "profile": {"firstName": "Ghost"}}],
        })
        assert confirm_r.status_code == 200
        body = confirm_r.json()
        assert body["created"] == []
        assert len(body["failed"]) == 1
        assert "not found" in body["failed"][0]["error"].lower()
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v -k confirm`
Expected: FAIL with 404 (route doesn't exist)

- [ ] **Step 3: Add the models and endpoint**

In `backend/routers/manual_candidates.py`, add these imports at the top (alongside the existing ones):

```python
from typing import List

from pydantic import BaseModel

from database.model import Certificate, Education, Experience, Hobby, JobPreferences, Language, Skill
from services.ai_matching import AIMatchingService
```

Add these model definitions after the imports, before `router = APIRouter(...)`:

```python
class ManualCandidateProfile(BaseModel):
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    birthDate: Optional[str] = ""
    title: Optional[str] = ""
    address: Optional[str] = ""
    linkedinUrl: Optional[str] = ""
    hobbies: Optional[List[Hobby]] = []
    skills: Optional[List[Skill]] = []
    languages: Optional[List[Language]] = []
    educations: Optional[List[Education]] = []
    experiences: Optional[List[Experience]] = []
    certificates: Optional[List[Certificate]] = []
    jobPreferences: Optional[JobPreferences] = JobPreferences()


class ManualCandidateConfirmItem(BaseModel):
    staged_id: str
    profile: ManualCandidateProfile


class ManualCandidateConfirmRequest(BaseModel):
    job_id: str
    candidates: List[ManualCandidateConfirmItem]
```

Append after `discard_staged_manual_candidate`:

```python
_SNAPSHOT_WHITELIST = [
    "certificates", "created_at", "cv", "educations",
    "experiences", "firstName", "hobbies", "jobPreferences",
    "languages", "lastName", "skills", "title",
]


@router.post("/confirm")
async def confirm_manual_candidates(
    body: ManualCandidateConfirmRequest,
    current_user: dict = Depends(require_roles(HR_SIDE_ROLES)),
):
    """
    Batch-confirm reviewed manual candidates: creates a `candidates` doc and
    a matching `job_applications` doc per item. Each item is handled
    independently so one failure never blocks the rest of the batch.
    """
    db = get_async_db()
    job = await _ensure_job_access(db, body.job_id, current_user)

    created = []
    failed = []

    for item in body.candidates:
        try:
            if not ObjectId.is_valid(item.staged_id):
                raise ValueError("Invalid staged_id")
            staged = await db.hr_manual_cv_staging.find_one({"_id": ObjectId(item.staged_id)})
            if not staged:
                raise ValueError("Staged CV not found")
            if staged.get("status") != "staged":
                raise ValueError(f"Staged CV already {staged.get('status')}")
            if staged.get("job_id") != body.job_id:
                raise ValueError("Staged CV does not belong to this job")

            profile = item.profile.model_dump()
            email = profile.pop("email", None)
            phone = profile.pop("phone", None)

            synthetic_user_id = f"manual-{ObjectId()}"
            now = datetime.utcnow()

            candidate_doc = {
                "user_id": synthetic_user_id,
                "email": email,
                "phone": phone,
                "source": "hr_manual",
                "added_by": current_user["id"],
                "company_id": job.get("company_id"),
                "cv": {
                    "filename": staged.get("filename"),
                    "content_type": staged.get("content_type"),
                    "size": staged.get("size"),
                    "file_path": staged.get("file_path"),
                },
                **profile,
                "created_at": now,
                "updated_at": now,
            }
            cand_result = await db.candidates.insert_one(candidate_doc)

            snapshot = {k: candidate_doc.get(k) for k in _SNAPSHOT_WHITELIST if k in candidate_doc}
            app_doc = {
                "candidate_id": synthetic_user_id,
                "job_id": body.job_id,
                "motivation_letter": None,
                "status": "new",
                "source": "hr_manual",
                "profile_snapshot": snapshot,
                "applied_at": now,
            }
            app_result = await db.job_applications.insert_one(app_doc)

            try:
                ai_service = AIMatchingService(db=db)
                await ai_service.vectorize_and_save_profile(synthetic_user_id, by_user_id=True)
                await ai_service.close()
            except Exception as vec_err:
                print(f"Failed to vectorize manual candidate {synthetic_user_id}: {vec_err}")

            await db.hr_manual_cv_staging.update_one(
                {"_id": staged["_id"]},
                {"$set": {"status": "confirmed", "updated_at": now}},
            )

            created.append({
                "staged_id": item.staged_id,
                "candidate_id": str(cand_result.inserted_id),
                "application_id": str(app_result.inserted_id),
            })
        except Exception as e:
            failed.append({"staged_id": item.staged_id, "error": str(e)})

    return {"created": created, "failed": failed}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/routers/manual_candidates.py backend/tests/test_manual_candidates.py
git commit -m "feat(backend): add POST /manual-candidates/confirm endpoint"
```

---

## Task 6: i18n keys for the new UI

**Files:**
- Modify: `frontend/src/assets/translations/hr/jobs-candidates.js`

**Interfaces:**
- Produces: translation keys consumed by Tasks 7–10's JSX via `t('key')`.

- [ ] **Step 1: Add English keys**

In `frontend/src/assets/translations/hr/jobs-candidates.js`, find the line `'hr-job-detail-analyze-btn': 'Analyze applications',` (line 341) in the `en:` block and add immediately after it:

```javascript
    'hr-job-detail-analyze-btn': 'Analyze applications',
    'hr-job-detail-manual-add-btn': 'Add candidates',
    'hr-manual-modal-title': 'Add candidates manually',
    'hr-manual-modal-drop-title': 'Drop CVs here',
    'hr-manual-modal-drop-hint': 'PDF, DOC, or DOCX — drop as many as you like',
    'hr-manual-modal-browse': 'or browse files',
    'hr-manual-modal-queued-count': '{count} file(s) selected',
    'hr-manual-modal-start-parsing': 'Analyze CVs',
    'hr-manual-modal-parsing-progress': '{done} / {total} parsed ({percent}%)',
    'hr-manual-modal-status-queued': 'Queued',
    'hr-manual-modal-status-parsing': 'Analyzing…',
    'hr-manual-modal-status-parsed': 'Ready',
    'hr-manual-modal-status-failed': 'Failed',
    'hr-manual-modal-retry': 'Retry',
    'hr-manual-modal-connection-issue': 'Connection interrupted — some files could not be analyzed.',
    'hr-manual-modal-resume': 'Resume',
    'hr-manual-modal-continue-review': 'Review {count} parsed candidate(s)',
    'hr-manual-modal-review-title': 'Candidate {current} of {total}',
    'hr-manual-modal-review-cv-label': 'Original CV',
    'hr-manual-modal-review-cv-unavailable': 'Preview unavailable for this file type — download to view.',
    'hr-manual-modal-review-download': 'Download CV',
    'hr-manual-modal-field-first-name': 'First name',
    'hr-manual-modal-field-last-name': 'Last name',
    'hr-manual-modal-field-email': 'Email',
    'hr-manual-modal-field-phone': 'Phone',
    'hr-manual-modal-field-title': 'Professional title',
    'hr-manual-modal-field-birth-date': 'Birth date',
    'hr-manual-modal-field-address': 'Address',
    'hr-manual-modal-field-linkedin': 'LinkedIn URL',
    'hr-manual-modal-section-skills': 'Skills',
    'hr-manual-modal-section-languages': 'Languages',
    'hr-manual-modal-section-experiences': 'Experience',
    'hr-manual-modal-section-educations': 'Education',
    'hr-manual-modal-section-certificates': 'Certificates',
    'hr-manual-modal-add-item': 'Add',
    'hr-manual-modal-remove-item': 'Remove',
    'hr-manual-modal-discard': 'Discard this candidate',
    'hr-manual-modal-confirm-next': 'Confirm & next',
    'hr-manual-modal-back': 'Back',
    'hr-manual-modal-submit': 'Add {count} candidate(s) to this job',
    'hr-manual-modal-submitting': 'Adding candidates…',
    'hr-manual-modal-result-title': 'Done',
    'hr-manual-modal-result-created': '{count} candidate(s) added',
    'hr-manual-modal-result-failed': '{count} failed',
    'hr-manual-modal-close': 'Close',
    'hr-manual-modal-cancel': 'Cancel',
    'hr-manual-modal-no-candidates': 'No candidates left to review.',
```

- [ ] **Step 2: Add French keys**

In the same file, find `'hr-job-detail-analyze-btn': 'Analyser les candidatures',` (line 790) in the `fr:` block and add immediately after it:

```javascript
    'hr-job-detail-analyze-btn': 'Analyser les candidatures',
    'hr-job-detail-manual-add-btn': 'Ajouter des candidats',
    'hr-manual-modal-title': 'Ajouter des candidats manuellement',
    'hr-manual-modal-drop-title': 'Déposez les CV ici',
    'hr-manual-modal-drop-hint': 'PDF, DOC ou DOCX — déposez-en autant que vous voulez',
    'hr-manual-modal-browse': 'ou parcourir les fichiers',
    'hr-manual-modal-queued-count': '{count} fichier(s) sélectionné(s)',
    'hr-manual-modal-start-parsing': 'Analyser les CV',
    'hr-manual-modal-parsing-progress': '{done} / {total} analysés ({percent}%)',
    'hr-manual-modal-status-queued': 'En attente',
    'hr-manual-modal-status-parsing': 'Analyse en cours…',
    'hr-manual-modal-status-parsed': 'Prêt',
    'hr-manual-modal-status-failed': 'Échec',
    'hr-manual-modal-retry': 'Réessayer',
    'hr-manual-modal-connection-issue': 'Connexion interrompue — certains fichiers n’ont pas pu être analysés.',
    'hr-manual-modal-resume': 'Reprendre',
    'hr-manual-modal-continue-review': 'Revoir {count} candidat(s) analysé(s)',
    'hr-manual-modal-review-title': 'Candidat {current} / {total}',
    'hr-manual-modal-review-cv-label': 'CV original',
    'hr-manual-modal-review-cv-unavailable': 'Aperçu indisponible pour ce type de fichier — téléchargez pour consulter.',
    'hr-manual-modal-review-download': 'Télécharger le CV',
    'hr-manual-modal-field-first-name': 'Prénom',
    'hr-manual-modal-field-last-name': 'Nom',
    'hr-manual-modal-field-email': 'Email',
    'hr-manual-modal-field-phone': 'Téléphone',
    'hr-manual-modal-field-title': 'Titre professionnel',
    'hr-manual-modal-field-birth-date': 'Date de naissance',
    'hr-manual-modal-field-address': 'Adresse',
    'hr-manual-modal-field-linkedin': 'URL LinkedIn',
    'hr-manual-modal-section-skills': 'Compétences',
    'hr-manual-modal-section-languages': 'Langues',
    'hr-manual-modal-section-experiences': 'Expériences',
    'hr-manual-modal-section-educations': 'Formations',
    'hr-manual-modal-section-certificates': 'Certificats',
    'hr-manual-modal-add-item': 'Ajouter',
    'hr-manual-modal-remove-item': 'Retirer',
    'hr-manual-modal-discard': 'Écarter ce candidat',
    'hr-manual-modal-confirm-next': 'Confirmer et suivant',
    'hr-manual-modal-back': 'Précédent',
    'hr-manual-modal-submit': 'Ajouter {count} candidat(s) à cette offre',
    'hr-manual-modal-submitting': 'Ajout des candidats…',
    'hr-manual-modal-result-title': 'Terminé',
    'hr-manual-modal-result-created': '{count} candidat(s) ajouté(s)',
    'hr-manual-modal-result-failed': '{count} échec(s)',
    'hr-manual-modal-close': 'Fermer',
    'hr-manual-modal-cancel': 'Annuler',
    'hr-manual-modal-no-candidates': 'Aucun candidat à revoir.',
```

- [ ] **Step 3: Verify the file still parses**

Run: `cd frontend && node -e "require('./src/assets/translations/hr/jobs-candidates.js')" 2>&1 | head -5`

If that errors on ESM `export const`, instead run: `cd frontend && npx eslint src/assets/translations/hr/jobs-candidates.js`
Expected: no syntax errors reported (existing lint warnings about unrelated lines, if any, are pre-existing and out of scope).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/assets/translations/hr/jobs-candidates.js
git commit -m "feat(frontend): add i18n keys for manual candidate CV upload"
```

---

## Task 7: Entry-point button + modal shell (Phase 1: drop zone)

**Files:**
- Modify: `frontend/src/apps/HR/jobs/detail/JobDetail.jsx`
- Modify: `frontend/src/apps/HR/jobs/detail/JobDetail.css`
- Create: `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx`
- Create: `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css`

**Interfaces:**
- Produces: `ManualCandidatesModal({isOpen, onClose, jobId, onCandidatesAdded})` React component — Tasks 8–10 add the remaining phases inside this same file. Local queue-item shape: `{localId: string, file: File, status: 'queued'|'parsing'|'parsed'|'failed', error: string|null, stagedId: string|null, profile: object|null, decision: 'pending'|'confirmed'|'discarded'}`.
- Consumes: `apiFetch` from `../../../../core/api`, `useLanguage` from `../../../../core/useLanguage`.

- [ ] **Step 1: Extract `loadApplications` as a reusable callback in JobDetail.jsx**

In `frontend/src/apps/HR/jobs/detail/JobDetail.jsx`, replace the effect at lines 303-317:

```javascript
    useEffect(() => {
        if (!id) return;
        const loadApplications = async () => {
            setAppLoading(true);
            try {
                const data = await apiFetch(`/applications/job/${id}`);
                setApplications(data || []);
            } catch (e) {
                console.error('Applications load error:', e);
            } finally {
                setAppLoading(false);
            }
        };
        loadApplications();
    }, [id]);
```

with:

```javascript
    const loadApplications = useCallback(async () => {
        if (!id) return;
        setAppLoading(true);
        try {
            const data = await apiFetch(`/applications/job/${id}`);
            setApplications(data || []);
        } catch (e) {
            console.error('Applications load error:', e);
        } finally {
            setAppLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadApplications();
    }, [loadApplications]);
```

- [ ] **Step 2: Add modal state and import**

In `frontend/src/apps/HR/jobs/detail/JobDetail.jsx`, add the import near the other local imports (after `import JobDetailCompanyMap from './JobDetailCompanyMap';`):

```javascript
import ManualCandidatesModal from './ManualCandidatesModal';
```

Add state right after the `const [statusMenuOpen, setStatusMenuOpen] = useState(false);` line:

```javascript
    const [manualModalOpen, setManualModalOpen] = useState(false);
```

- [ ] **Step 3: Add the button next to "Analyser"**

Replace the `hjd-right-head` block:

```jsx
                                <div className="hjd-right-head">
                                    <h2>{t('hr-job-detail-candidates-title')}</h2>
                                    {job?.allow_hr === false ? (
                                        <p style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', maxWidth: '350px', textAlign: 'right', margin: 0 }}>
                                            {t('hr-job-detail-auto-msg')}
                                        </p>
                                     ) : (
                                        <button
                                            type="button"
                                            className="hjd-analyze-btn"
                                            onClick={loadApplicantScores}
                                            disabled={aiApplicantLoading || applications.length === 0}
                                        >
                                            <span className="material-symbols-outlined">
                                                {aiApplicantLoading ? 'hourglass_empty' : 'auto_awesome'}
                                            </span>
                                            {aiApplicantLoading ? t('hr-job-detail-analyzing') : t('hr-job-detail-analyze-btn')}
                                        </button>
                                    )}
                                </div>
```

with:

```jsx
                                <div className="hjd-right-head">
                                    <h2>{t('hr-job-detail-candidates-title')}</h2>
                                    {job?.allow_hr === false ? (
                                        <p style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', maxWidth: '350px', textAlign: 'right', margin: 0 }}>
                                            {t('hr-job-detail-auto-msg')}
                                        </p>
                                     ) : (
                                        <div className="hjd-right-head-actions">
                                            <button
                                                type="button"
                                                className="hjd-manual-add-btn"
                                                onClick={() => setManualModalOpen(true)}
                                            >
                                                <span className="material-symbols-outlined">upload_file</span>
                                                {t('hr-job-detail-manual-add-btn')}
                                            </button>
                                            <button
                                                type="button"
                                                className="hjd-analyze-btn"
                                                onClick={loadApplicantScores}
                                                disabled={aiApplicantLoading || applications.length === 0}
                                            >
                                                <span className="material-symbols-outlined">
                                                    {aiApplicantLoading ? 'hourglass_empty' : 'auto_awesome'}
                                                </span>
                                                {aiApplicantLoading ? t('hr-job-detail-analyzing') : t('hr-job-detail-analyze-btn')}
                                            </button>
                                        </div>
                                    )}
                                </div>
```

- [ ] **Step 4: Render the modal**

Right before the final closing `</div>` of the component (the one that closes `hjd-page`, immediately after `</main>`), add:

```jsx
            <ManualCandidatesModal
                isOpen={manualModalOpen}
                onClose={() => setManualModalOpen(false)}
                jobId={id}
                onCandidatesAdded={loadApplications}
            />
```

So the end of the file's return statement becomes:

```jsx
            </main>
            <ManualCandidatesModal
                isOpen={manualModalOpen}
                onClose={() => setManualModalOpen(false)}
                jobId={id}
                onCandidatesAdded={loadApplications}
            />
        </div>
    );
};

export default JobDetail;
```

- [ ] **Step 5: Add the button + head-actions CSS**

In `frontend/src/apps/HR/jobs/detail/JobDetail.css`, right after the `.hjd-right-head` block (around line 992-997), add:

```css
.hjd-right-head-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.hjd-manual-add-btn {
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    border-radius: 8px;
    height: 34px;
    padding: 0 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
}

.hjd-manual-add-btn:hover {
    border-color: var(--text);
}
```

- [ ] **Step 6: Create the modal shell with the drop zone**

Create `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx`:

```jsx
import React, { useCallback, useRef, useState } from 'react';
import { useLanguage } from '../../../../core/useLanguage';
import { apiFetch } from '../../../../core/api';
import './ManualCandidatesModal.css';

const ACCEPTED_EXTS = ['.pdf', '.doc', '.docx'];

const isAcceptedFile = (file) => {
    const name = (file?.name || '').toLowerCase();
    return ACCEPTED_EXTS.some((ext) => name.endsWith(ext));
};

const ManualCandidatesModal = ({ isOpen, onClose, jobId, onCandidatesAdded }) => {
    const { t } = useLanguage();
    const [phase, setPhase] = useState('drop'); // 'drop' | 'parsing' | 'review' | 'submitting' | 'result'
    const [queue, setQueue] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const resetAndClose = useCallback(() => {
        setPhase('drop');
        setQueue([]);
        onClose();
    }, [onClose]);

    const handleFilesSelected = useCallback((fileList) => {
        const files = Array.from(fileList || []).filter(isAcceptedFile);
        if (files.length === 0) return;
        setQueue((prev) => [
            ...prev,
            ...files.map((file) => ({
                localId: crypto.randomUUID(),
                file,
                status: 'queued',
                error: null,
                stagedId: null,
                profile: null,
                decision: 'pending',
            })),
        ]);
    }, []);

    const removeQueuedFile = useCallback((localId) => {
        setQueue((prev) => prev.filter((q) => q.localId !== localId));
    }, []);

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFilesSelected(e.dataTransfer.files);
    };

    if (!isOpen) return null;

    return (
        <div className="mcm-overlay" onClick={resetAndClose}>
            <div className="mcm-card" onClick={(e) => e.stopPropagation()}>
                <header className="mcm-header">
                    <h2>{t('hr-manual-modal-title')}</h2>
                    <button type="button" className="mcm-close" onClick={resetAndClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div className="mcm-body">
                    {phase === 'drop' && (
                        <>
                            <div
                                className={`mcm-dropzone${dragOver ? ' mcm-dropzone--over' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <span className="material-symbols-outlined mcm-dropzone-icon">cloud_upload</span>
                                <strong>{t('hr-manual-modal-drop-title')}</strong>
                                <span className="mcm-dropzone-hint">{t('hr-manual-modal-drop-hint')}</span>
                                <span className="mcm-dropzone-browse">{t('hr-manual-modal-browse')}</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx"
                                    className="mcm-hidden-input"
                                    onChange={(e) => handleFilesSelected(e.target.files)}
                                />
                            </div>

                            {queue.length > 0 && (
                                <div className="mcm-queued-list">
                                    <p className="mcm-queued-count">
                                        {t('hr-manual-modal-queued-count').replace('{count}', queue.length)}
                                    </p>
                                    {queue.map((q) => (
                                        <div key={q.localId} className="mcm-queued-row">
                                            <span className="material-symbols-outlined">description</span>
                                            <span className="mcm-queued-name">{q.file.name}</span>
                                            <button
                                                type="button"
                                                className="mcm-queued-remove"
                                                onClick={() => removeQueuedFile(q.localId)}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mcm-actions">
                                <button type="button" className="mcm-btn mcm-btn--secondary" onClick={resetAndClose}>
                                    {t('hr-manual-modal-cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="mcm-btn mcm-btn--primary"
                                    disabled={queue.length === 0}
                                    onClick={() => setPhase('parsing')}
                                >
                                    {t('hr-manual-modal-start-parsing')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualCandidatesModal;
```

- [ ] **Step 7: Create the CSS file**

Create `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css`:

```css
.mcm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 15, 20, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
}

.mcm-card {
    background: var(--panel);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 16px;
    width: min(720px, 100%);
    max-height: min(85vh, 900px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.mcm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.1rem 1.4rem;
    border-bottom: 1px solid var(--border);
}

.mcm-header h2 {
    margin: 0;
    font-size: 1.15rem;
}

.mcm-close {
    border: none;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    display: inline-flex;
    padding: 0.25rem;
    border-radius: 8px;
}

.mcm-close:hover {
    background: rgba(127, 127, 127, 0.15);
}

.mcm-body {
    padding: 1.4rem;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.mcm-dropzone {
    border: 2px dashed var(--border);
    border-radius: 14px;
    padding: 2.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
}

.mcm-dropzone--over {
    border-color: var(--text);
    background: rgba(127, 127, 127, 0.08);
}

.mcm-dropzone-icon {
    font-size: 2.5rem;
    opacity: 0.7;
}

.mcm-dropzone-hint {
    font-size: 0.8rem;
    opacity: 0.65;
}

.mcm-dropzone-browse {
    font-size: 0.8rem;
    text-decoration: underline;
    opacity: 0.8;
}

.mcm-hidden-input {
    display: none;
}

.mcm-queued-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.mcm-queued-count {
    font-size: 0.8rem;
    font-weight: 600;
    opacity: 0.7;
    margin: 0;
}

.mcm-queued-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 8px;
}

.mcm-queued-name {
    flex: 1;
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mcm-queued-remove {
    border: none;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    opacity: 0.6;
}

.mcm-queued-remove:hover {
    opacity: 1;
}

.mcm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: auto;
    padding-top: 0.5rem;
}

.mcm-btn {
    border-radius: 8px;
    height: 36px;
    padding: 0 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.mcm-btn--primary {
    border: none;
    background: var(--text);
    color: var(--panel);
}

.mcm-btn--primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.mcm-btn--secondary {
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
}
```

- [ ] **Step 8: Run lint**

Run: `cd frontend && npm run lint`
Expected: no new errors on the four modified/created files (pre-existing warnings elsewhere are out of scope)

- [ ] **Step 9: Run the CSS collision checker**

Run: `cd frontend && npm run check:css-collisions`
Expected: passes (the `mcm-` prefix and `hjd-manual-add-btn`/`hjd-right-head-actions` names are new, no collisions)

- [ ] **Step 10: Manual browser verification**

Run: `cd frontend && npm run dev` (and `cd backend && venv\Scripts\python -m uvicorn main:app --reload` in another terminal if not already running). Log in as HR, open a job's detail page, confirm the "Ajouter des candidats" button appears next to "Analyser les candidatures", click it, confirm the modal opens with a working drag-and-drop zone and file browser, and that selected files appear in the queued list with remove buttons working. Close the modal and confirm it resets.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/apps/HR/jobs/detail/JobDetail.jsx frontend/src/apps/HR/jobs/detail/JobDetail.css frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css
git commit -m "feat(frontend): add manual candidates modal entry point and drop zone"
```

---

## Task 8: Parsing phase (Phase 2) — concurrency, progress, error isolation

**Files:**
- Modify: `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx`
- Modify: `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css`

**Interfaces:**
- Consumes: `POST /api/manual-candidates/parse` (Task 3) via `apiFetch`.
- Produces: fills `queue[i].status/stagedId/profile/error`; sets `phase` to `'review'` once HR clicks continue. `connectionIssue` boolean state for the "paused" banner.

- [ ] **Step 1: Add parsing state, the worker-pool runner, and the parsing UI**

In `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx`, add these constants above the component:

```jsx
const PARSE_CONCURRENCY = 3;
const MAX_CONSECUTIVE_FAILURES = 3;

const parseOneFile = async (item, jobId) => {
    const formData = new FormData();
    formData.append('job_id', jobId);
    formData.append('cv', item.file, item.file.name);
    return apiFetch('/manual-candidates/parse', { method: 'POST', body: formData });
};
```

Add state, right after `const [dragOver, setDragOver] = useState(false);`:

```jsx
    const [isParsingActive, setIsParsingActive] = useState(false);
    const [connectionIssue, setConnectionIssue] = useState(false);
```

Add the `patchQueueItem` helper and `runParsingQueue`, right after `handleFilesSelected`:

```jsx
    const patchQueueItem = useCallback((localId, patch) => {
        setQueue((prev) => prev.map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
    }, []);

    const runParsingQueue = useCallback(async (items) => {
        const pending = items.filter((q) => q.status === 'queued' || q.status === 'failed');
        if (pending.length === 0) return;

        setIsParsingActive(true);
        setConnectionIssue(false);
        const failureState = { consecutive: 0, stopped: false };
        let nextIdx = 0;

        const worker = async () => {
            for (;;) {
                if (failureState.stopped) return;
                const idx = nextIdx;
                nextIdx += 1;
                if (idx >= pending.length) return;
                const item = pending[idx];

                patchQueueItem(item.localId, { status: 'parsing', error: null });
                try {
                    const res = await parseOneFile(item, jobId);
                    failureState.consecutive = 0;
                    patchQueueItem(item.localId, { status: 'parsed', stagedId: res.staged_id, profile: res.parsed });
                } catch (err) {
                    failureState.consecutive += 1;
                    patchQueueItem(item.localId, { status: 'failed', error: err.message || 'Parsing failed' });
                    if (failureState.consecutive >= MAX_CONSECUTIVE_FAILURES) {
                        failureState.stopped = true;
                        setConnectionIssue(true);
                    }
                }
            }
        };

        await Promise.all(Array.from({ length: Math.min(PARSE_CONCURRENCY, pending.length) }, worker));
        setIsParsingActive(false);
    }, [jobId, patchQueueItem]);

    const startParsing = useCallback(() => {
        setPhase('parsing');
        runParsingQueue(queue);
    }, [queue, runParsingQueue]);

    const retryFailed = useCallback(() => {
        runParsingQueue(queue);
    }, [queue, runParsingQueue]);
```

Update the "Analyze CVs" button in the `'drop'` phase to call `startParsing` instead of directly setting the phase:

```jsx
                                <button
                                    type="button"
                                    className="mcm-btn mcm-btn--primary"
                                    disabled={queue.length === 0}
                                    onClick={startParsing}
                                >
                                    {t('hr-manual-modal-start-parsing')}
                                </button>
```

Add the parsing phase UI right after the `{phase === 'drop' && ( ... )}` block, still inside `<div className="mcm-body">`:

```jsx
                    {phase === 'parsing' && (() => {
                        const total = queue.length;
                        const settled = queue.filter((q) => q.status === 'parsed' || q.status === 'failed').length;
                        const parsedCount = queue.filter((q) => q.status === 'parsed').length;
                        const percent = total === 0 ? 0 : Math.round((settled / total) * 100);
                        const STATUS_LABEL_KEY = {
                            queued: 'hr-manual-modal-status-queued',
                            parsing: 'hr-manual-modal-status-parsing',
                            parsed: 'hr-manual-modal-status-parsed',
                            failed: 'hr-manual-modal-status-failed',
                        };
                        return (
                            <>
                                <div className="mcm-progress-wrap">
                                    <div className="mcm-progress-track">
                                        <div className="mcm-progress-fill" style={{ width: `${percent}%` }} />
                                    </div>
                                    <span className="mcm-progress-label">
                                        {t('hr-manual-modal-parsing-progress')
                                            .replace('{done}', settled)
                                            .replace('{total}', total)
                                            .replace('{percent}', percent)}
                                    </span>
                                </div>

                                {connectionIssue && (
                                    <div className="mcm-connection-banner">
                                        <span className="material-symbols-outlined">wifi_off</span>
                                        <span>{t('hr-manual-modal-connection-issue')}</span>
                                        <button type="button" className="mcm-btn mcm-btn--secondary" onClick={retryFailed}>
                                            {t('hr-manual-modal-resume')}
                                        </button>
                                    </div>
                                )}

                                <div className="mcm-queued-list">
                                    {queue.map((q) => (
                                        <div key={q.localId} className={`mcm-queued-row mcm-queued-row--${q.status}`}>
                                            <span className="material-symbols-outlined">description</span>
                                            <span className="mcm-queued-name">{q.file.name}</span>
                                            <span className="mcm-queued-status">{t(STATUS_LABEL_KEY[q.status])}</span>
                                            {q.status === 'failed' && (
                                                <button
                                                    type="button"
                                                    className="mcm-queued-remove"
                                                    title={q.error || ''}
                                                    onClick={() => runParsingQueue([q])}
                                                >
                                                    <span className="material-symbols-outlined">refresh</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="mcm-actions">
                                    <button type="button" className="mcm-btn mcm-btn--secondary" onClick={resetAndClose}>
                                        {t('hr-manual-modal-cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        className="mcm-btn mcm-btn--primary"
                                        disabled={isParsingActive || parsedCount === 0}
                                        onClick={() => setPhase('review')}
                                    >
                                        {t('hr-manual-modal-continue-review').replace('{count}', parsedCount)}
                                    </button>
                                </div>
                            </>
                        );
                    })()}
```

- [ ] **Step 2: Add the parsing-phase CSS**

Append to `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css`:

```css
.mcm-progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.mcm-progress-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(127, 127, 127, 0.2);
    overflow: hidden;
}

.mcm-progress-fill {
    height: 100%;
    background: var(--text);
    transition: width 0.25s ease;
}

.mcm-progress-label {
    font-size: 0.78rem;
    opacity: 0.7;
}

.mcm-connection-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid #ef4444;
    background: rgba(239, 68, 68, 0.08);
    border-radius: 8px;
    font-size: 0.8rem;
}

.mcm-connection-banner span:nth-child(2) {
    flex: 1;
}

.mcm-queued-status {
    font-size: 0.75rem;
    font-weight: 600;
    opacity: 0.7;
    white-space: nowrap;
}

.mcm-queued-row--failed {
    border-color: #ef4444;
}

.mcm-queued-row--parsed {
    border-color: #22c55e;
}
```

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint`
Expected: no new errors

- [ ] **Step 4: Manual browser verification**

With backend running with `FAKE_ANALYSIS=1` set in `backend/.env` (to avoid real LLM calls while testing), drop 3-4 PDF/DOCX files, click "Analyser les CV", and confirm: the progress bar advances, each row shows a status, and "Revoir N candidat(s) analysé(s)" becomes enabled once at least one succeeds. Temporarily stop the backend mid-batch to confirm the connection banner appears and "Reprendre" resumes the remaining files once the backend is back.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css
git commit -m "feat(frontend): add concurrent CV parsing phase with progress and retry"
```

---

## Task 9: Review phase (Phase 3) — one-at-a-time edit + CV preview

**Files:**
- Modify: `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx`
- Modify: `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css`

**Interfaces:**
- Consumes: `DELETE /api/manual-candidates/staged/{staged_id}` (Task 4) via `apiFetch`.
- Produces: sets `queue[i].decision` to `'confirmed'` (with the edited `profile`) or `'discarded'`; advances to `phase: 'result-ready'`... actually advances internal `reviewIndex`; when review is done, phase moves to `'submit'` (handled in Task 10).

- [ ] **Step 1: Add the generic list-field editor and the review panel subcomponent**

In `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx`, add these subcomponents above `const ManualCandidatesModal = (...) => {`:

```jsx
const TextField = ({ label, value, onChange, type = 'text' }) => (
    <label className="mcm-field">
        <span className="mcm-field-label">{label}</span>
        <input
            type={type}
            className="mcm-field-input"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        />
    </label>
);

const SkillLikeListEditor = ({ label, items, onChange }) => {
    const [draftName, setDraftName] = useState('');
    const list = Array.isArray(items) ? items : [];

    const addItem = () => {
        const name = draftName.trim();
        if (!name) return;
        onChange([...list, { id: crypto.randomUUID(), name, level: 50 }]);
        setDraftName('');
    };

    const removeItem = (id) => onChange(list.filter((it) => it.id !== id));

    return (
        <div className="mcm-list-editor">
            <span className="mcm-field-label">{label}</span>
            <div className="mcm-tag-list">
                {list.map((it) => (
                    <span key={it.id} className="mcm-tag">
                        {it.name}
                        <button type="button" onClick={() => removeItem(it.id)}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </span>
                ))}
            </div>
            <div className="mcm-tag-input-row">
                <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                />
                <button type="button" className="mcm-btn mcm-btn--secondary" onClick={addItem}>
                    <span className="material-symbols-outlined">add</span>
                </button>
            </div>
        </div>
    );
};

const GroupListEditor = ({ label, items, onChange, fields, emptyItem }) => {
    const list = Array.isArray(items) ? items : [];

    const updateAt = (idx, key, value) => {
        const next = list.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
        onChange(next);
    };

    const addGroup = () => onChange([...list, { id: crypto.randomUUID(), ...emptyItem }]);
    const removeGroup = (idx) => onChange(list.filter((_, i) => i !== idx));

    return (
        <div className="mcm-list-editor">
            <span className="mcm-field-label">{label}</span>
            {list.map((it, idx) => (
                <div key={it.id ?? idx} className="mcm-group-row">
                    {fields.map((f) => (
                        <input
                            key={f.key}
                            type="text"
                            placeholder={f.placeholder}
                            className="mcm-group-input"
                            value={it[f.key] || ''}
                            onChange={(e) => updateAt(idx, f.key, e.target.value)}
                        />
                    ))}
                    <button type="button" className="mcm-queued-remove" onClick={() => removeGroup(idx)}>
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                </div>
            ))}
            <button type="button" className="mcm-btn mcm-btn--secondary" onClick={addGroup}>
                <span className="material-symbols-outlined">add</span>
            </button>
        </div>
    );
};

const CvPreview = ({ file, t }) => {
    const [previewUrl, setPreviewUrl] = useState(null);
    const isPdf = (file?.name || '').toLowerCase().endsWith('.pdf');

    React.useEffect(() => {
        if (!file || !isPdf) {
            setPreviewUrl(null);
            return undefined;
        }
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file, isPdf]);

    if (isPdf && previewUrl) {
        return <iframe src={`${previewUrl}#toolbar=0`} className="mcm-cv-iframe" title={file.name} />;
    }

    const downloadUrl = file ? URL.createObjectURL(file) : null;
    return (
        <div className="mcm-cv-fallback">
            <span className="material-symbols-outlined">description</span>
            <p>{file?.name}</p>
            <p className="mcm-cv-fallback-hint">{t('hr-manual-modal-review-cv-unavailable')}</p>
            {downloadUrl && (
                <a href={downloadUrl} download={file.name} className="mcm-btn mcm-btn--secondary">
                    {t('hr-manual-modal-review-download')}
                </a>
            )}
        </div>
    );
};

const CandidateReviewPanel = ({ item, index, total, onChange, onDiscard, onConfirm, onBack, canGoBack, t }) => {
    const profile = item.profile || {};

    const setField = (key, value) => onChange({ ...profile, [key]: value });

    return (
        <div className="mcm-review-panel">
            <p className="mcm-review-counter">
                {t('hr-manual-modal-review-title').replace('{current}', index + 1).replace('{total}', total)}
            </p>
            <div className="mcm-review-grid">
                <div className="mcm-review-form">
                    <div className="mcm-field-row">
                        <TextField label={t('hr-manual-modal-field-first-name')} value={profile.firstName} onChange={(v) => setField('firstName', v)} />
                        <TextField label={t('hr-manual-modal-field-last-name')} value={profile.lastName} onChange={(v) => setField('lastName', v)} />
                    </div>
                    <div className="mcm-field-row">
                        <TextField label={t('hr-manual-modal-field-email')} value={profile.email} onChange={(v) => setField('email', v)} type="email" />
                        <TextField label={t('hr-manual-modal-field-phone')} value={profile.phone} onChange={(v) => setField('phone', v)} />
                    </div>
                    <TextField label={t('hr-manual-modal-field-title')} value={profile.title} onChange={(v) => setField('title', v)} />
                    <div className="mcm-field-row">
                        <TextField label={t('hr-manual-modal-field-birth-date')} value={profile.birthDate} onChange={(v) => setField('birthDate', v)} type="date" />
                        <TextField label={t('hr-manual-modal-field-linkedin')} value={profile.linkedinUrl} onChange={(v) => setField('linkedinUrl', v)} />
                    </div>
                    <TextField label={t('hr-manual-modal-field-address')} value={profile.address} onChange={(v) => setField('address', v)} />

                    <SkillLikeListEditor label={t('hr-manual-modal-section-skills')} items={profile.skills} onChange={(v) => setField('skills', v)} />
                    <SkillLikeListEditor label={t('hr-manual-modal-section-languages')} items={profile.languages} onChange={(v) => setField('languages', v)} />

                    <GroupListEditor
                        label={t('hr-manual-modal-section-experiences')}
                        items={profile.experiences}
                        onChange={(v) => setField('experiences', v)}
                        fields={[
                            { key: 'jobTitle', placeholder: 'Job title' },
                            { key: 'company', placeholder: 'Company' },
                            { key: 'startYear', placeholder: 'Start year' },
                            { key: 'endYear', placeholder: 'End year' },
                        ]}
                        emptyItem={{ jobTitle: '', company: '', startYear: '', endYear: '', ongoing: false, description: '' }}
                    />
                    <GroupListEditor
                        label={t('hr-manual-modal-section-educations')}
                        items={profile.educations}
                        onChange={(v) => setField('educations', v)}
                        fields={[
                            { key: 'degree', placeholder: 'Degree' },
                            { key: 'institution', placeholder: 'Institution' },
                            { key: 'startYear', placeholder: 'Start year' },
                            { key: 'endYear', placeholder: 'End year' },
                        ]}
                        emptyItem={{ degree: '', institution: '', startYear: '', endYear: '', ongoing: false }}
                    />
                    <GroupListEditor
                        label={t('hr-manual-modal-section-certificates')}
                        items={profile.certificates}
                        onChange={(v) => setField('certificates', v)}
                        fields={[
                            { key: 'name', placeholder: 'Certificate name' },
                            { key: 'issuer', placeholder: 'Issuer' },
                            { key: 'year', placeholder: 'Year' },
                        ]}
                        emptyItem={{ name: '', issuer: '', year: '', url: null }}
                    />
                </div>
                <div className="mcm-review-cv">
                    <span className="mcm-field-label">{t('hr-manual-modal-review-cv-label')}</span>
                    <CvPreview file={item.file} t={t} />
                </div>
            </div>

            <div className="mcm-actions">
                <button type="button" className="mcm-btn mcm-btn--secondary" onClick={onBack} disabled={!canGoBack}>
                    {t('hr-manual-modal-back')}
                </button>
                <button type="button" className="mcm-btn mcm-btn--danger" onClick={onDiscard}>
                    {t('hr-manual-modal-discard')}
                </button>
                <button type="button" className="mcm-btn mcm-btn--primary" onClick={onConfirm}>
                    {t('hr-manual-modal-confirm-next')}
                </button>
            </div>
        </div>
    );
};
```

- [ ] **Step 2: Wire the review phase into the main component**

Add state right after `const [connectionIssue, setConnectionIssue] = useState(false);`:

```jsx
    const [reviewIndex, setReviewIndex] = useState(0);
```

Add the discard handler and review-list derivation, right after `runParsingQueue`/`startParsing`/`retryFailed`:

```jsx
    const discardStaged = useCallback(async (stagedId) => {
        if (!stagedId) return;
        try {
            await apiFetch(`/manual-candidates/staged/${stagedId}`, { method: 'DELETE' });
        } catch (err) {
            console.error('Failed to discard staged CV:', err);
        }
    }, []);
```

Add the review phase UI right after the `{phase === 'parsing' && (...)}()` block, still inside `<div className="mcm-body">`:

```jsx
                    {phase === 'review' && (() => {
                        const reviewable = queue.filter((q) => q.status === 'parsed' && q.decision === 'pending');
                        if (reviewable.length === 0) {
                            return (
                                <>
                                    <p className="mcm-empty">{t('hr-manual-modal-no-candidates')}</p>
                                    <div className="mcm-actions">
                                        <button type="button" className="mcm-btn mcm-btn--secondary" onClick={resetAndClose}>
                                            {t('hr-manual-modal-cancel')}
                                        </button>
                                    </div>
                                </>
                            );
                        }
                        const safeIndex = Math.min(reviewIndex, reviewable.length - 1);
                        const current = reviewable[safeIndex];

                        return (
                            <CandidateReviewPanel
                                item={current}
                                index={safeIndex}
                                total={reviewable.length}
                                canGoBack={safeIndex > 0}
                                t={t}
                                onChange={(profile) => patchQueueItem(current.localId, { profile })}
                                onBack={() => setReviewIndex((i) => Math.max(0, i - 1))}
                                onDiscard={() => {
                                    discardStaged(current.stagedId);
                                    patchQueueItem(current.localId, { decision: 'discarded' });
                                    setReviewIndex(0);
                                }}
                                onConfirm={() => {
                                    patchQueueItem(current.localId, { decision: 'confirmed' });
                                    setReviewIndex(0);
                                }}
                            />
                        );
                    })()}
```

- [ ] **Step 3: Add the review-panel CSS**

Append to `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css`:

```css
.mcm-review-counter {
    font-size: 0.8rem;
    font-weight: 700;
    opacity: 0.7;
    margin: 0;
}

.mcm-review-grid {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 1.2rem;
    align-items: start;
}

.mcm-review-form {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}

.mcm-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
}

.mcm-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.mcm-field-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.6;
}

.mcm-field-input {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    padding: 0.45rem 0.6rem;
    font-size: 0.85rem;
}

.mcm-list-editor {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.mcm-tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
}

.mcm-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    background: rgba(127, 127, 127, 0.15);
    font-size: 0.78rem;
}

.mcm-tag button {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    padding: 0;
}

.mcm-tag-input-row {
    display: flex;
    gap: 0.4rem;
}

.mcm-tag-input-row input {
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
}

.mcm-group-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)) auto;
    gap: 0.4rem;
    align-items: center;
}

.mcm-group-input {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    padding: 0.4rem 0.5rem;
    font-size: 0.78rem;
}

.mcm-review-cv {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    position: sticky;
    top: 0;
}

.mcm-cv-iframe {
    width: 100%;
    height: 460px;
    border: 1px solid var(--border);
    border-radius: 10px;
}

.mcm-cv-fallback {
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    text-align: center;
}

.mcm-cv-fallback-hint {
    font-size: 0.75rem;
    opacity: 0.6;
}

.mcm-btn--danger {
    border: 1px solid #ef4444;
    background: transparent;
    color: #ef4444;
}

.mcm-empty {
    text-align: center;
    opacity: 0.6;
    padding: 2rem 0;
}

@media (max-width: 720px) {
    .mcm-review-grid {
        grid-template-columns: 1fr;
    }
}
```

- [ ] **Step 4: Run lint**

Run: `cd frontend && npm run lint`
Expected: no new errors

- [ ] **Step 5: Manual browser verification**

Parse a small batch, move to review, confirm: fields are editable, skills/languages can be added/removed as tags, experience/education/certificate rows can be added/removed, the CV preview renders inline for PDFs and shows a download fallback for DOC/DOCX, "Discard this candidate" removes it and calls the delete endpoint (check Network tab), and "Confirm & next" advances through all candidates until the "no candidates left" empty state shows.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css
git commit -m "feat(frontend): add one-at-a-time candidate review with CV preview"
```

---

## Task 10: Submit phase (Phase 4) — batch confirm, results, list refresh

**Files:**
- Modify: `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx`
- Modify: `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css`

**Interfaces:**
- Consumes: `POST /api/manual-candidates/confirm` (Task 5) via `apiFetch`; calls `onCandidatesAdded()` (passed from `JobDetail.jsx`, Task 7) on close.
- Produces: final `result-ready` submit action and `result` phase UI; closes and refreshes the applications table.

- [ ] **Step 1: Auto-advance from review to submit and add the submit trigger**

In `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx`, add state right after `const [reviewIndex, setReviewIndex] = useState(0);`:

```jsx
    const [submitResult, setSubmitResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
```

Update the "no candidates left to review" branch inside the `phase === 'review'` block so it distinguishes "nothing was ever confirmed" from "all confirmed/discarded, ready to submit". Replace:

```jsx
                        const reviewable = queue.filter((q) => q.status === 'parsed' && q.decision === 'pending');
                        if (reviewable.length === 0) {
                            return (
                                <>
                                    <p className="mcm-empty">{t('hr-manual-modal-no-candidates')}</p>
                                    <div className="mcm-actions">
                                        <button type="button" className="mcm-btn mcm-btn--secondary" onClick={resetAndClose}>
                                            {t('hr-manual-modal-cancel')}
                                        </button>
                                    </div>
                                </>
                            );
                        }
```

with:

```jsx
                        const reviewable = queue.filter((q) => q.status === 'parsed' && q.decision === 'pending');
                        const confirmedCount = queue.filter((q) => q.decision === 'confirmed').length;
                        if (reviewable.length === 0) {
                            return (
                                <>
                                    <p className="mcm-empty">{t('hr-manual-modal-no-candidates')}</p>
                                    <div className="mcm-actions">
                                        <button type="button" className="mcm-btn mcm-btn--secondary" onClick={resetAndClose}>
                                            {t('hr-manual-modal-cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            className="mcm-btn mcm-btn--primary"
                                            disabled={confirmedCount === 0}
                                            onClick={() => setPhase('submit')}
                                        >
                                            {t('hr-manual-modal-submit').replace('{count}', confirmedCount)}
                                        </button>
                                    </div>
                                </>
                            );
                        }
```

- [ ] **Step 2: Add the submit function**

Add right after `discardStaged`:

```jsx
    const submitConfirmed = useCallback(async () => {
        const confirmedItems = queue.filter((q) => q.decision === 'confirmed');
        if (confirmedItems.length === 0) return;

        setIsSubmitting(true);
        try {
            const res = await apiFetch('/manual-candidates/confirm', {
                method: 'POST',
                body: JSON.stringify({
                    job_id: jobId,
                    candidates: confirmedItems.map((q) => ({ staged_id: q.stagedId, profile: q.profile })),
                }),
            });
            setSubmitResult(res);
            if (res.created.length > 0) {
                onCandidatesAdded();
            }
        } catch (err) {
            setSubmitResult({ created: [], failed: confirmedItems.map((q) => ({ staged_id: q.stagedId, error: err.message || 'Request failed' })) });
        } finally {
            setIsSubmitting(false);
            setPhase('result');
        }
    }, [queue, jobId, onCandidatesAdded]);

    const retryFailedSubmissions = useCallback(async () => {
        if (!submitResult || submitResult.failed.length === 0) return;
        const failedIds = new Set(submitResult.failed.map((f) => f.staged_id));
        const itemsToRetry = queue.filter((q) => failedIds.has(q.stagedId));
        if (itemsToRetry.length === 0) return;

        setIsSubmitting(true);
        try {
            const res = await apiFetch('/manual-candidates/confirm', {
                method: 'POST',
                body: JSON.stringify({
                    job_id: jobId,
                    candidates: itemsToRetry.map((q) => ({ staged_id: q.stagedId, profile: q.profile })),
                }),
            });
            setSubmitResult((prev) => ({
                created: [...prev.created, ...res.created],
                failed: res.failed,
            }));
            if (res.created.length > 0) {
                onCandidatesAdded();
            }
        } catch (err) {
            console.error('Retry submission failed:', err);
        } finally {
            setIsSubmitting(false);
        }
    }, [submitResult, queue, jobId, onCandidatesAdded]);
```

- [ ] **Step 3: Add the submit and result phase UI**

Add right after the `{phase === 'review' && (...)}()` block, still inside `<div className="mcm-body">`:

```jsx
                    {phase === 'submit' && (() => {
                        const confirmedCount = queue.filter((q) => q.decision === 'confirmed').length;
                        if (!isSubmitting && !submitResult) {
                            submitConfirmed();
                        }
                        return (
                            <div className="mcm-submitting">
                                <span className="material-symbols-outlined mcm-spin">progress_activity</span>
                                <p>{t('hr-manual-modal-submitting').replace('{count}', confirmedCount)}</p>
                            </div>
                        );
                    })()}

                    {phase === 'result' && submitResult && (
                        <>
                            <div className="mcm-result">
                                <h3>{t('hr-manual-modal-result-title')}</h3>
                                <p className="mcm-result-created">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    {t('hr-manual-modal-result-created').replace('{count}', submitResult.created.length)}
                                </p>
                                {submitResult.failed.length > 0 && (
                                    <>
                                        <p className="mcm-result-failed">
                                            <span className="material-symbols-outlined">error</span>
                                            {t('hr-manual-modal-result-failed').replace('{count}', submitResult.failed.length)}
                                        </p>
                                        <ul className="mcm-result-failed-list">
                                            {submitResult.failed.map((f) => (
                                                <li key={f.staged_id}>{f.error}</li>
                                            ))}
                                        </ul>
                                        <button
                                            type="button"
                                            className="mcm-btn mcm-btn--secondary"
                                            disabled={isSubmitting}
                                            onClick={retryFailedSubmissions}
                                        >
                                            {t('hr-manual-modal-retry')}
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="mcm-actions">
                                <button type="button" className="mcm-btn mcm-btn--primary" onClick={resetAndClose}>
                                    {t('hr-manual-modal-close')}
                                </button>
                            </div>
                        </>
                    )}
```

- [ ] **Step 4: Add the submit/result CSS**

Append to `frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css`:

```css
.mcm-submitting {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 3rem 0;
    opacity: 0.75;
}

.mcm-spin {
    animation: mcm-spin 1s linear infinite;
}

@keyframes mcm-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.mcm-result h3 {
    margin: 0 0 0.6rem;
}

.mcm-result-created,
.mcm-result-failed {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
    margin: 0.3rem 0;
}

.mcm-result-created {
    color: #22c55e;
}

.mcm-result-failed {
    color: #ef4444;
}

.mcm-result-failed-list {
    margin: 0.3rem 0 0.6rem;
    padding-left: 1.4rem;
    font-size: 0.8rem;
    opacity: 0.8;
}
```

- [ ] **Step 5: Run lint and build**

Run: `cd frontend && npm run lint`
Expected: no new errors

Run: `cd frontend && npm run build`
Expected: build succeeds with no errors

- [ ] **Step 6: Manual browser end-to-end verification**

With the backend running (`FAKE_ANALYSIS=1` for a fast pass, then once more without it against a couple of real CV PDFs for a realistic check): drop several CVs → parse → review and confirm each (discard at least one to verify cleanup) → reach the submit phase → confirm the result screen shows the right created/failed counts → close the modal → confirm the Job Detail candidates table immediately shows the newly-added applications with status "Nouveau" → click "Analyser les candidatures" and confirm the manually-added candidates get scored exactly like normal applicants.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.jsx frontend/src/apps/HR/jobs/detail/ManualCandidatesModal.css
git commit -m "feat(frontend): add batch submit, result summary, and applications refresh"
```

---

## Final verification checklist

- [ ] Run the full backend test suite: `cd backend && venv\Scripts\python -m pytest tests/ -v` — confirm no regressions in unrelated tests.
- [ ] Run `cd frontend && npm run lint` and `npm run build` clean.
- [ ] Run `cd frontend && npm run check:css-collisions`.
- [ ] Full manual pass in the browser per Task 10 Step 6, including the connection-loss/retry path from Task 8 Step 4.
- [ ] Confirm `docs/superpowers/specs/2026-07-20-manual-candidate-cv-upload-design.md` still accurately reflects what was built; note any deviations.
