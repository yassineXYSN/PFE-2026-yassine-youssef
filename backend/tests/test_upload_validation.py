import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.uploads import validate_upload, IMAGE_EXTS, MAX_IMAGE_BYTES


def test_accepts_valid_png():
    ext = validate_upload("photo.PNG", b"x" * 10, allowed_exts=IMAGE_EXTS, max_bytes=MAX_IMAGE_BYTES)
    assert ext == ".png"


def test_rejects_disallowed_extension():
    with pytest.raises(HTTPException) as e:
        validate_upload("evil.svg", b"<svg/>", allowed_exts=IMAGE_EXTS, max_bytes=MAX_IMAGE_BYTES)
    assert e.value.status_code == 400


def test_rejects_no_extension():
    with pytest.raises(HTTPException) as e:
        validate_upload("noext", b"x", allowed_exts=IMAGE_EXTS, max_bytes=MAX_IMAGE_BYTES)
    assert e.value.status_code == 400


def test_rejects_oversize():
    with pytest.raises(HTTPException) as e:
        validate_upload("big.png", b"x" * (MAX_IMAGE_BYTES + 1), allowed_exts=IMAGE_EXTS, max_bytes=MAX_IMAGE_BYTES)
    assert e.value.status_code == 413
