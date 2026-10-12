FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN groupadd --system agora && useradd --system --gid agora --home /app agora \
    && pip install --no-cache-dir "uv==0.9.5"

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY alembic.ini ./
COPY alembic ./alembic
COPY api ./api
COPY run.py docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R agora:agora /app

USER agora
EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "run:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
