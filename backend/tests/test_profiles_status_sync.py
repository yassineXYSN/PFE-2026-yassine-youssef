"""
Profile status sync — Integration test.

Verifies that PUT /api/profiles/{id} with a status field updates both
MongoDB (hr_profiles.status) and MySQL (profiles.status) — closing the
split-brain bug where only the Mongo copy was ever updated by this route.

Run tests:
    cd backend
    python -m pytest tests/test_profiles_status_sync.py -v
"""

import os
import sys
import uuid

import pytest
from fastapi.testclient import TestClient
from passlib.context import CryptContext

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database.mysql import get_db
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_conn():
    gen = get_db()
    conn = next(gen)
    return gen, conn


def _release(gen):
    try:
        next(gen)
    except StopIteration:
        pass


@pytest.fixture
def pending_hr_user():
    user_id = str(uuid.uuid4())
    email = f"profile-sync-test-{user_id}@example.com"

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, email, pwd_context.hash("irrelevant"))
            )
            cursor.execute(
                "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "admin", "pending", "Test", "User")
            )
        conn.commit()
    finally:
        _release(gen)

    mongo_db = connect_mongodb()["HumatiQ"]
    mongo_db.hr_profiles.insert_one({"_id": user_id, "email": email, "status": "pending"})

    yield user_id

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        _release(gen)
    mongo_db.hr_profiles.delete_one({"_id": user_id})


def test_put_profile_status_syncs_mysql_and_mongo(pending_hr_user):
    user_id = pending_hr_user

    app.dependency_overrides[get_current_user] = lambda: {
        "id": "requester-id", "email": "admin@example.com", "role": "superadmin",
        "company_id": None, "department_id": None,
    }
    try:
        client = TestClient(app)
        response = client.put(f"/api/profiles/{user_id}", json={"status": "active"})
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200

    mongo_db = connect_mongodb()["HumatiQ"]
    mongo_doc = mongo_db.hr_profiles.find_one({"_id": user_id})
    assert mongo_doc["status"] == "active"

    gen, conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT status FROM profiles WHERE id = %s", (user_id,))
            mysql_row = cursor.fetchone()
    finally:
        _release(gen)
    assert mysql_row["status"] == "active"
