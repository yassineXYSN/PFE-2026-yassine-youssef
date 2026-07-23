# syntax=docker/dockerfile:1

############################
# Builder: install Python deps into a venv
############################
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Build tools needed to compile some wheels (e.g. native extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Isolated virtualenv we can copy into the runtime image
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --upgrade pip

# Install CPU-only torch/torchvision first from the CPU wheel index so the
# default CUDA builds (multi-GB) are never pulled in.
RUN pip install --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision

# Remaining dependencies. torch/torchvision are already satisfied above, so
# pip will skip them here.
COPY requirements.txt .
RUN pip install -r requirements.txt

############################
# Runtime
############################
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    HF_HOME=/models/hf \
    TRANSFORMERS_CACHE=/models/hf \
    HF_HUB_DISABLE_TELEMETRY=1

# Runtime system libraries:
#   ffmpeg                -> faster-whisper audio decoding
#   tesseract-ocr         -> pytesseract OCR
#   libgl1 / libglib2.0   -> opencv + mediapipe
#   libsm6/libxext6/...    -> opencv image backends
RUN apt-get update && apt-get install -y --no-install-recommends \
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
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
