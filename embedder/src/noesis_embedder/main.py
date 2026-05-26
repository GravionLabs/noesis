from __future__ import annotations

import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

import httpx
import psycopg2
from fastapi import FastAPI, BackgroundTasks
from pgvector.psycopg2 import register_vector
from pydantic import BaseModel
from pydantic_settings import BaseSettings

from noesis_embedder.events import EmbedCompleted, StartEmbedJob
from noesis_embedder.logging.logging import setup_logging
from noesis_embedder.messages import Consumer, MessageBroker, setup_consumers
from noesis_embedder.providers import huggingface as hf_provider
from noesis_embedder.routes.repo_analyzer_routes import router as repo_analyzer_router

setup_logging()
logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    database_url: str = "postgres://noesis:noesis_dev@localhost:5432/noesis"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"
    server_url: str = "http://localhost:5000"
    openai_api_key: str = ""
    ollama_url: str = "http://localhost:11434"
    embedding_provider: Literal["openai", "ollama", "huggingface"] = "huggingface"
    embedding_model: str = "BAAI/bge-large-en-v1.5"
    # Used as fallback for openai/ollama — auto-detected for huggingface.
    embedding_dimensions: int = 1536

    class Config:
        env_file = ".env"


settings = Settings()

# ---------------------------------------------------------------------------
# RabbitMQ broker + consumer registry
# ---------------------------------------------------------------------------

broker = MessageBroker(settings.rabbitmq_url)
consumer = Consumer()

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_db():
    conn = psycopg2.connect(settings.database_url)
    register_vector(conn)
    return conn


# ---------------------------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------------------------

async def embed_openai(texts: list[str]) -> list[list[float]]:
    if not settings.openai_api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. "
            "Set the OPENAI_API_KEY environment variable or switch EMBEDDING_PROVIDER."
        )
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"input": texts, "model": settings.embedding_model},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in data["data"]]


async def embed_ollama(texts: list[str]) -> list[list[float]]:
    vectors = []
    async with httpx.AsyncClient() as client:
        for text in texts:
            resp = await client.post(
                f"{settings.ollama_url}/api/embeddings",
                json={"model": settings.embedding_model, "prompt": text},
                timeout=60,
            )
            resp.raise_for_status()
            vectors.append(resp.json()["embedding"])
    return vectors


async def embed_huggingface(texts: list[str]) -> list[list[float]]:
    return await hf_provider.embed(texts, settings.embedding_model)


async def embed(texts: list[str]) -> list[list[float]]:
    if settings.embedding_provider == "ollama":
        return await embed_ollama(texts)
    if settings.embedding_provider == "huggingface":
        return await embed_huggingface(texts)
    return await embed_openai(texts)


def get_embedding_dimensions() -> int:
    """Return the active embedding dimensions — auto-detected for huggingface."""
    if settings.embedding_provider == "huggingface":
        return hf_provider.get_dimensions(settings.embedding_model)
    return settings.embedding_dimensions


async def embed_single(text: str) -> list[float]:
    vectors = await embed([text])
    return vectors[0]


# ---------------------------------------------------------------------------
# Chunk processing — loops until all chunks for the source are embedded
# ---------------------------------------------------------------------------

async def process_pending_chunks(source_id: str | None = None) -> int:
    total = 0
    while True:
        count = await _process_batch(source_id)
        total += count
        if count == 0:
            break
    return total


async def _process_batch(source_id: str | None = None) -> int:
    conn = get_db()
    cur = conn.cursor()

    query = """
        SELECT c.id, c.content FROM chunks c
        WHERE NOT EXISTS (
            SELECT 1 FROM embeddings e
            WHERE e.chunk_id = c.id AND e.model = %s
        )
    """
    params: list = [settings.embedding_model]
    if source_id:
        query += " AND c.source_id = %s"
        params.append(source_id)
    query += " LIMIT 100"

    try:
        cur.execute(query, params)
        rows = cur.fetchall()

        if not rows:
            return 0

        chunk_ids = [str(r[0]) for r in rows]
        texts = [r[1] for r in rows]

        vectors = await embed(texts)

        for chunk_id, vector in zip(chunk_ids, vectors):
            cur.execute(
                """INSERT INTO embeddings (id, chunk_id, model, dimensions, vector, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (chunk_id, model) DO NOTHING""",
                (str(uuid.uuid4()), chunk_id, settings.embedding_model, get_embedding_dimensions(), vector, datetime.now(timezone.utc)),
            )

        conn.commit()
        return len(rows)
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


async def embed_and_callback(source_id: str | None, job_id: str | None) -> None:
    """Embed pending chunks then notify the server via callback."""
    try:
        count = await process_pending_chunks(source_id)
        logger.info("Embedding complete — job=%s chunks=%d", job_id, count)
    except Exception:
        logger.exception("Embedding failed — job=%s source=%s", job_id, source_id)
        count = 0

    if job_id:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{settings.server_url}/api/internal/embed-completed",
                    json={"jobId": job_id, "sourceId": source_id, "chunkCount": count},
                    timeout=10,
                )
                logger.info("Callback sent — job=%s chunks=%d", job_id, count)
        except Exception:
            logger.exception("Failed to send embed-completed callback for job %s", job_id)


    return len(rows)


# ---------------------------------------------------------------------------
# Message handlers
# ---------------------------------------------------------------------------

@consumer.subscribe(queue_name="noesis.start-embed-job")
async def handle_start_embed_job(event: StartEmbedJob) -> None:
    logger.info("StartEmbedJob received — job=%s source=%s", event.job_id, event.source_id)

    total = await process_pending_chunks(event.source_id)

    logger.info("Embedding complete — job=%s chunks=%d", event.job_id, total)

    await broker.publish(
        "noesis.embed-completed",
        EmbedCompleted(job_id=event.job_id, source_id=event.source_id, chunk_count=total),
    )


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(application: FastAPI):
    if settings.embedding_provider == "openai" and not settings.openai_api_key:
        logger.error(
            "OPENAI_API_KEY is not set but EMBEDDING_PROVIDER=openai. "
            "Embedding requests will fail. Set OPENAI_API_KEY or change EMBEDDING_PROVIDER."
        )
    if settings.embedding_provider == "huggingface":
        # Pre-load model on startup to avoid cold-start on first embed request.
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, hf_provider.get_dimensions, settings.embedding_model)
    try:
        await broker.connect()
        await setup_consumers(broker, consumer)
    except Exception:
        logger.exception("Failed to connect to RabbitMQ — starting without consumer")
    yield
    await broker.close()


app = FastAPI(title="Noesis Embedder", lifespan=lifespan)


class EmbedRequest(BaseModel):
    source_id: str | None = None
    job_id: str | None = None


class EmbedQueryRequest(BaseModel):
    text: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": settings.embedding_provider,
        "model": settings.embedding_model,
        "dimensions": get_embedding_dimensions(),
    }


@app.post("/embed")
async def trigger_embed(req: EmbedRequest, background_tasks: BackgroundTasks):
    """Trigger async embedding. Calls back via POST /api/internal/embed-completed when done."""
    background_tasks.add_task(embed_and_callback, req.source_id, req.job_id)
    return {"status": "accepted"}


@app.post("/embed/sync")
async def embed_sync(req: EmbedRequest):
    """Synchronous embedding — blocks until all chunks are embedded."""
    count = await process_pending_chunks(req.source_id)
    return {"embedded": count}


@app.post("/embed/query")
async def embed_query(req: EmbedQueryRequest):
    """Embed a single query string synchronously for search-time use."""
    vector = await embed_single(req.text)
    return {"vector": vector, "model": settings.embedding_model, "dimensions": get_embedding_dimensions()}


# Include repo analyzer routes
app.include_router(repo_analyzer_router)
