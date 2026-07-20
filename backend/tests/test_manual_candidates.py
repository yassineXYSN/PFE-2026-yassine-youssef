import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from main import app
from middleware.auth import get_current_user
from database.mongodb import connect_mongodb
import database.mongodb_async as mongodb_async

client = TestClient(app)


@pytest.fixture(autouse=True)
def _fresh_async_mongo_client_per_test():
    """
    TestClient.post() (without a `with` block) spins up a brand-new asyncio
    event loop for each call. AsyncIOMotorClient lazily caches the event loop
    it first sees, so the module-level singleton in database.mongodb_async
    goes stale across tests and raises "RuntimeError: Event loop is closed"
    on the second/third request. Resetting the cached client before/after each
    test forces it to be rebuilt inside that test's own (currently running)
    event loop.
    """
    mongodb_async._client = None
    yield
    mongodb_async._client = None


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
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for staged in db.hr_manual_cv_staging.find({"job_id": job_id}):
        file_path = staged.get("file_path")
        if file_path:
            abs_path = os.path.join(backend_root, file_path.replace("/", os.sep))
            if os.path.isfile(abs_path):
                os.remove(abs_path)
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
