import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.account_analysis import parse_cv_bytes


@pytest.mark.asyncio
async def test_parse_cv_bytes_fake_mode_pdf(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    result = await parse_cv_bytes(b"%PDF-1.4 not a real pdf", "resume.pdf")
    assert result["title"].startswith("[FAKE]")
    assert isinstance(result["skills"], list)


@pytest.mark.asyncio
async def test_parse_cv_bytes_fake_mode_docx(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    result = await parse_cv_bytes(b"not a real docx either", "resume.docx")
    assert result["title"].startswith("[FAKE]")


@pytest.mark.asyncio
async def test_parse_cv_bytes_rejects_unsupported_extension(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    with pytest.raises(ValueError):
        await parse_cv_bytes(b"whatever", "resume.txt")
