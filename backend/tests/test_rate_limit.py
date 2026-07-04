import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)


def test_login_is_rate_limited():
    # Wrong creds return 401/400; after the limit we expect 429 within the window.
    codes = [client.post("/api/auth/login", json={"email": "x@x.io", "password": "nope"}).status_code
             for _ in range(12)]
    assert 429 in codes
