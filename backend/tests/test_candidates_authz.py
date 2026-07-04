import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from middleware.auth import get_current_user

client = TestClient(app)


def _as(role):
    return lambda: {"id": "u1", "email": "u@x.io", "role": role,
                    "company_id": "c1", "department_id": None}


def test_candidat_cannot_list_candidates():
    app.dependency_overrides[get_current_user] = _as("candidat")
    try:
        r = client.get("/api/candidates")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_candidat_cannot_read_candidate_detail():
    app.dependency_overrides[get_current_user] = _as("candidat")
    try:
        r = client.get("/api/candidates/some-id")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_candidat_cannot_download_cv():
    app.dependency_overrides[get_current_user] = _as("candidat")
    try:
        r = client.get("/api/candidates/some-id/cv/download")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()
