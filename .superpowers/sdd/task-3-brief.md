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

