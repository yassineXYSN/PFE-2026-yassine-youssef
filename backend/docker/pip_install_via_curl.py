"""Install pip requirements without letting pip's own downloader fetch the
actual wheel bytes.

Some CDN edges reachable from this network corrupt TLS records once a
transfer sustains high throughput (SSL "bad record mac" / "record layer
failure") -- confirmed as an external network issue, reproducible even from
bare Windows with no Docker/WSL/pip involved, and independent of which HTTP
client is used. Rate-limiting the download avoids it reliably, but pip has no
built-in bandwidth cap. curl does (`--limit-rate`, mature and reliable), so:
use `pip install --dry-run --report` to resolve dependencies and get exact
wheel URLs (metadata-only, small requests -- unaffected by the bug), download
each wheel with rate-limited curl, then `pip install --no-index
--find-links=<dir>` to install purely from local files with no further
network access.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse


def main():
    args = sys.argv[1:]
    with tempfile.TemporaryDirectory() as tmp:
        report_path = Path(tmp) / "report.json"
        wheels_dir = Path(tmp) / "wheels"
        wheels_dir.mkdir()

        subprocess.run(
            [
                "pip", "install", "--dry-run", "--quiet",
                "--report", str(report_path),
                *args,
            ],
            check=True,
        )

        report = json.loads(report_path.read_text())
        for pkg in report["install"]:
            url = pkg["download_info"]["url"]
            if not url.startswith(("http://", "https://")):
                continue  # local/editable installs have no URL to fetch
            # URLs are percent-encoded (e.g. "%2B" for "+"); the wheel filename
            # must be decoded back to its literal form (e.g.
            # "torch-2.13.0+cpu-...whl") or pip's --find-links directory scan
            # won't recognize the file as matching the resolved requirement.
            filename = unquote(Path(urlparse(url).path).name)
            dest = wheels_dir / filename
            subprocess.run(
                [
                    "curl", "-fSL", "--retry", "5", "--retry-all-errors",
                    # Some CDN edges on this network path corrupt TLS records
                    # once a transfer sustains high throughput (confirmed:
                    # fails identically on bare Windows, no Docker/WSL
                    # involved -- a real external network issue, not
                    # something fixable via local config). Capping bandwidth
                    # avoids it reliably regardless of which host is hit.
                    "--limit-rate", "512k",
                    "-o", str(dest), url,
                ],
                check=True,
            )

        subprocess.run(
            [
                "pip", "install", "--no-index",
                "--find-links", str(wheels_dir),
                *args,
            ],
            check=True,
        )


if __name__ == "__main__":
    main()
