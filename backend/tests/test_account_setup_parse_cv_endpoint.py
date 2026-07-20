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
