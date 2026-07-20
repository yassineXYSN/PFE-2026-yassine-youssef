import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _mock_auth(monkeypatch):
    """Stub out get_user_id_from_token as imported into account_setup's module
    namespace, so requests reach the extension-check/parsing logic instead of
    short-circuiting on a 401.
    """
    monkeypatch.setattr(
        "routes.candidat.account_setup.get_user_id_from_token",
        lambda authorization: "test-user-1",
    )


def test_parse_cv_rejects_unsupported_extension(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    _mock_auth(monkeypatch)

    files = {"cv": ("resume.txt", b"hello", "text/plain")}
    r = client.post(
        "/api/candidat/account-setup/parse-cv",
        files=files,
        headers={"Authorization": "Bearer fake"},
    )
    assert r.status_code == 400
    assert "Only PDF, DOC, or DOCX" in r.text


def test_parse_cv_accepts_docx(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    _mock_auth(monkeypatch)

    try:
        import docx

        doc = docx.Document()
        doc.add_paragraph("John Doe - Senior Engineer")

        buf = io.BytesIO()
        doc.save(buf)
        buf.seek(0)
        docx_bytes = buf.read()
    except ImportError:
        import pytest

        pytest.skip("python-docx not installed")

    files = {"cv": ("resume.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    r = client.post(
        "/api/candidat/account-setup/parse-cv",
        files=files,
        headers={"Authorization": "Bearer fake"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title"].startswith("[FAKE]")
