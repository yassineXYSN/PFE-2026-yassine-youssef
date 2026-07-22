# syntax=docker/dockerfile:1

############################
# Builder: install Python deps into a venv
############################
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100 \
    PIP_RETRIES=10

# Build tools needed to compile some wheels (e.g. native extensions)
# apt over plain HTTP gets corrupted by some network middleboxes ("Hash Sum
# mismatch"), so force the Debian mirrors to HTTPS first.
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Isolated virtualenv we can copy into the runtime image
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Some CDN edges reachable from this network corrupt TLS records once a
# transfer sustains high throughput (SSL "bad record mac" / "record layer
# failure") -- confirmed as an external network issue, reproducible even from
# bare Windows with no Docker/WSL/pip involved. Rate-limiting the download
# avoids it reliably, but pip has no built-in bandwidth cap; curl does. Let
# pip only resolve dependencies (small metadata requests, unaffected by the
# bug) and have rate-limited curl fetch the actual wheels. See
# docker/pip_install_via_curl.py.
COPY docker/pip_install_via_curl.py /tmp/pip_install_via_curl.py

RUN python /tmp/pip_install_via_curl.py --upgrade pip

# Install CPU-only torch first from the CPU wheel index so the default CUDA
# build (multi-GB) is never pulled in.
RUN python /tmp/pip_install_via_curl.py --index-url https://download.pytorch.org/whl/cpu \
    torch

# Remaining dependencies. torch is already satisfied above, so pip will skip
# it here.
COPY requirements.txt .
RUN python /tmp/pip_install_via_curl.py -r requirements.txt

############################
# Runtime
############################
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    HF_HOME=/models/hf \
    HF_HUB_DISABLE_TELEMETRY=1

# Runtime system libraries:
#   ffmpeg                -> faster-whisper audio decoding
#   tesseract-ocr         -> pytesseract OCR
#   libgl1 / libglib2.0   -> opencv + mediapipe
#   libsm6/libxext6/...    -> opencv image backends
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy the prebuilt virtualenv from the builder stage
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

# Application code (the build context is the backend/ directory)
COPY . /app

# Persisted model cache + writable static/upload dir
RUN mkdir -p /models/hf /app/static

# Run as a non-root user
RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app /models
USER appuser

EXPOSE 8000

# main.py adds its own directory to sys.path, so imports such as
# `from database.mongodb import ...` resolve correctly with module path main:app.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
