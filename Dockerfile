FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# SECURITY: Run as non-root user
RUN adduser --disabled-password --no-create-home --gecos "" appuser
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app/uploads

COPY --chown=appuser:appuser backend/ .
USER appuser

CMD ["python", "-m", "app.main"]
