import inspect
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.candidat import twofa


def test_login_verify_endpoint_exists():
    assert hasattr(twofa, "login_verify_totp")
    sig = inspect.signature(twofa.login_verify_totp)
    assert "payload" in sig.parameters
