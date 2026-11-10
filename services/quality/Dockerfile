FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        git curl ca-certificates nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# gitleaks binary (picks the right build for the CPU)
ARG GITLEAKS_VERSION=8.18.4
RUN ARCH=$(uname -m); \
    if [ "$ARCH" = "aarch64" ]; then ARCH=arm64; else ARCH=x64; fi; \
    curl -sSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin gitleaks

WORKDIR /app

COPY services/quality/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/__init__.py services/__init__.py
COPY services/common services/common
COPY services/quality services/quality

COPY services/eslint services/eslint
RUN cd services/eslint && npm ci --omit=dev

ENV PYTHONUNBUFFERED=1
EXPOSE 8002
CMD ["uvicorn", "services.quality.main:app", "--host", "0.0.0.0", "--port", "8002"]