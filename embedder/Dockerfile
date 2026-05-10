FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency manifest and lockfile first (layer cache)
COPY pyproject.toml uv.lock ./

# Install production dependencies only (no venv — install into system Python)
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY main.py ./

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
