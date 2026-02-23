# ============= BUILD STAGE =============
FROM python:3.11-slim AS builder

# Build tools needed to compile C-extension packages (e.g. geopy, cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install packages into /root/.local so they can be copied cleanly to the
# runtime stage without dragging along gcc/build-essential.
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --user -r requirements.txt

# ============= RUNTIME STAGE =============
FROM python:3.11-slim

# Only runtime system libraries — no compiler toolchain
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Pull compiled site-packages from the builder (no source code leaked in)
COPY --from=builder /root/.local /root/.local

# Application source
COPY . .

# Make pip --user installs available on PATH
ENV PATH=/root/.local/bin:$PATH

# Cloud Run injects PORT; default to 8000 for local runs.
ENV PORT=8000
EXPOSE 8000

# NOTE: GOOGLE_APPLICATION_CREDENTIALS is not needed on Cloud Run —
# the attached service account provides ADC automatically.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
