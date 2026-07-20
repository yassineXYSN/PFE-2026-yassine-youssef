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
from utils.files import get_upload_dir
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


def _call(method, url, **kw):
    """
    Wrapper around client.get/post/delete/... that resets the cached Motor
    client immediately before the call. Each individual TestClient call gets
    its own fresh event loop (see the autouse fixture above), so any test
    that issues more than one request needs this reset between calls, not
    just once at test start. Use this for every multi-call test.
    """
    mongodb_async._client = None
    return getattr(client, method)(url, **kw)


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


async def _raise_parse_error(*args, **kwargs):
    raise ValueError("boom")


def test_parse_failure_cleans_up_staged_file_and_doc(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    monkeypatch.setattr("routers.manual_candidates.parse_cv_bytes", _raise_parse_error)
    job_id = _make_job()
    try:
        app.dependency_overrides[get_current_user] = _as("hr")
        db = _db()
        upload_dir = get_upload_dir()
        files_before = set(os.listdir(upload_dir))
        count_before = db.hr_manual_cv_staging.count_documents({"job_id": job_id})
        assert count_before == 0

        files = {"cv": ("resume.pdf", b"%PDF fake resume content", "application/pdf")}
        r = client.post("/api/manual-candidates/parse", data={"job_id": job_id}, files=files)
        assert r.status_code == 500, r.text
        assert "CV Parsing failed" in r.json()["detail"]

        count_after = db.hr_manual_cv_staging.count_documents({"job_id": job_id})
        assert count_after == count_before == 0

        files_after = set(os.listdir(upload_dir))
        assert files_after == files_before, "orphaned upload file left behind after failed parse"
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)


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

        # This test issues more than one request; use _call() so the cached
        # Motor client is reset before each one (see _call's docstring).
        del_r = _call("delete", f"/api/manual-candidates/staged/{staged_id}")
        assert del_r.status_code == 200
        assert del_r.json()["ok"] is True
        assert db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)}) is None
        assert not os.path.isfile(abs_path)

        # Deleting again is a safe no-op
        del_r2 = _call("delete", f"/api/manual-candidates/staged/{staged_id}")
        assert del_r2.status_code == 200
        assert del_r2.json().get("already_removed") is True
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)


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

        # This test issues more than one request; use _call() so the cached
        # Motor client is reset before each one (see _call's docstring).
        confirm_r = _call("post", "/api/manual-candidates/confirm", json={
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


async def _raise_mark_staged_confirmed_error(*args, **kwargs):
    raise RuntimeError("staging update boom")


def test_confirm_rolls_back_application_when_staging_update_fails(monkeypatch):
    """
    If the staging doc's status update (the final step of confirming an
    item, after both the candidate and job_applications docs already
    exist) throws, both the candidate and the job_applications doc must be
    rolled back - a job_applications doc must never be left pointing at a
    candidate_id whose candidates doc was deleted.
    """
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    monkeypatch.setattr(
        "routers.manual_candidates._mark_staged_confirmed",
        _raise_mark_staged_confirmed_error,
    )
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

        # This test issues more than one request; use _call() so the cached
        # Motor client is reset before each one (see _call's docstring).
        confirm_r = _call("post", "/api/manual-candidates/confirm", json={
            "job_id": job_id,
            "candidates": [{"staged_id": staged_id, "profile": parsed_profile}],
        })
        assert confirm_r.status_code == 200, confirm_r.text
        body = confirm_r.json()

        assert body["created"] == []
        assert len(body["failed"]) == 1
        assert body["failed"][0]["staged_id"] == staged_id
        assert "staging update boom" in body["failed"][0]["error"]

        db = _db()
        assert db.candidates.find_one({"cv.filename": "resume.pdf", "source": "hr_manual"}) is None
        assert db.job_applications.find_one({"job_id": job_id}) is None

        staged = db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)})
        assert staged["status"] == "staged"
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)


def test_confirm_batch_isolates_bad_item_from_good_sibling(monkeypatch):
    """
    A batch with one real staged CV and one bogus staged_id must create the
    real candidate/application while reporting only the bogus item as
    failed - i.e. one item's failure must not affect a sibling item's
    success within the same /confirm request.
    """
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

        ghost_staged_id = str(ObjectId())

        # This test issues more than one request; use _call() so the cached
        # Motor client is reset before each one (see _call's docstring).
        confirm_r = _call("post", "/api/manual-candidates/confirm", json={
            "job_id": job_id,
            "candidates": [
                {"staged_id": staged_id, "profile": parsed_profile},
                {"staged_id": ghost_staged_id, "profile": {"firstName": "Ghost"}},
            ],
        })
        assert confirm_r.status_code == 200, confirm_r.text
        body = confirm_r.json()

        assert len(body["created"]) == 1
        assert body["created"][0]["staged_id"] == staged_id

        assert len(body["failed"]) == 1
        assert body["failed"][0]["staged_id"] == ghost_staged_id
        assert "not found" in body["failed"][0]["error"].lower()

        candidate_id = body["created"][0]["candidate_id"]
        application_id = body["created"][0]["application_id"]

        db = _db()
        candidate = db.candidates.find_one({"_id": ObjectId(candidate_id)})
        assert candidate is not None
        assert candidate["user_id"].startswith("manual-")
        assert candidate["source"] == "hr_manual"
        assert candidate["email"] == "jane.doe@example.com"
        assert candidate["firstName"] == "Jane"

        application = db.job_applications.find_one({"_id": ObjectId(application_id)})
        assert application is not None
        assert application["job_id"] == job_id
        assert application["status"] == "new"
        assert application["candidate_id"] == candidate["user_id"]

        staged = db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)})
        assert staged["status"] == "confirmed"
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)
