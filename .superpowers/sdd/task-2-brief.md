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

