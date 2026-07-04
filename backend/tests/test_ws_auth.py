import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dependencies import create_access_token
from utils.ws_auth import decode_ws_token


def test_decode_rejects_missing_token():
    assert decode_ws_token(None) is None
    assert decode_ws_token("") is None


def test_decode_rejects_garbage():
    assert decode_ws_token("not-a-jwt") is None


def test_decode_accepts_valid_token():
    tok = create_access_token({"id": "u1", "email": "u@x.io", "role": "hr"})
    claims = decode_ws_token(tok)
    assert claims is not None
    assert claims["id"] == "u1"
    assert claims["role"] == "hr"
