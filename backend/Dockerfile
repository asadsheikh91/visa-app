FROM python:3.12-slim AS base

WORKDIR /app

# System deps: build tools for asyncpg/cryptography wheels that need compiling,
# plus everything Playwright's Chromium needs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright's own installer pulls in Chromium's system libs (--with-deps),
# so we don't have to hand-maintain that apt list.
RUN python -m playwright install --with-deps chromium

COPY . .

RUN useradd --create-home --shell /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

COPY --chown=appuser:appuser docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
