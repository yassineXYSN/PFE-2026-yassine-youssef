import inspect
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.candidat import twofa


def test_verify_totp_does_not_use_query_param():
    sig = inspect.signature(twofa.verify_totp)
    # 'code' must no longer be a bare str query param; it comes from the body.
    assert "code" not in sig.parameters or sig.parameters["code"].annotation is not str
