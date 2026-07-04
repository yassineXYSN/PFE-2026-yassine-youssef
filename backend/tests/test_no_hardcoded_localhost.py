import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [
    "routers/interviews.py",
    "utils/schedulers.py",
    "routes/candidat/profile.py",
]


def test_no_hardcoded_localhost_urls():
    offenders = []
    for rel in TARGETS:
        with open(os.path.join(BASE, rel), encoding="utf-8") as fh:
            for i, line in enumerate(fh, 1):
                if re.search(r"https?://localhost", line) and "getenv" not in line:
                    offenders.append(f"{rel}:{i}")
    assert not offenders, f"Hardcoded localhost URLs: {offenders}"
