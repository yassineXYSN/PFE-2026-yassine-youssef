import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import auth


def test_short_password_rejected():
    with pytest.raises(HTTPException) as e:
        auth._validate_password("abc123")
    assert e.value.status_code == 400


def test_valid_password_ok():
    auth._validate_password("abcd1234")  # no exception
