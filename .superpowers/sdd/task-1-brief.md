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

