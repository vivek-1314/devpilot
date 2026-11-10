FROM python:3.12-slim

# git is needed by the clone step
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY services/code_intelligence/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/__init__.py services/__init__.py
COPY services/common services/common
COPY services/code_intelligence services/code_intelligence

ENV PYTHONUNBUFFERED=1
EXPOSE 8001
CMD ["uvicorn", "services.code_intelligence.main:app", "--host", "0.0.0.0", "--port", "8001"]