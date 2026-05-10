from __future__ import annotations

import asyncio
import os
from typing import Literal

import httpx
import psycopg2
from fastapi import FastAPI, BackgroundTasks
from pgvector.psycopg2 import register_vector
from pydantic import BaseModel
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgres://noesis:noesis_dev@localhost:5432/noesis"
    openai_api_key: str = ""
    ollama_url: str = "http://localhost:11434"
    embedding_provider: Literal["openai", "ollama"] = "openai"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    class Config:
        env_file = ".env"


settings = Settings()
app = FastAPI(title="Noesis Embedder")


def get_db():
    conn = psycopg2.connect(settings.database_url)
    register_vector(conn)
    return conn


async def embed_openai(texts: list[str]) -> list[list[float]]:
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


async def embed(texts: list[str]) -> list[list[float]]:
    if settings.embedding_provider == "ollama":
        return await embed_ollama(texts)
    return await embed_openai(texts)


async def process_pending_chunks(source_id: str | None = None) -> int:
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

    cur.execute(query, params)
    rows = cur.fetchall()

    if not rows:
        cur.close()
        conn.close()
        return 0

    chunk_ids = [str(r[0]) for r in rows]
    texts = [r[1] for r in rows]

    vectors = await embed(texts)

    for chunk_id, vector in zip(chunk_ids, vectors):
        cur.execute(
            """INSERT INTO embeddings (chunk_id, model, dimensions, vector)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (chunk_id, model) DO NOTHING""",
            (chunk_id, settings.embedding_model, settings.embedding_dimensions, vector),
        )

    conn.commit()
    cur.close()
    conn.close()
    return len(rows)


class EmbedRequest(BaseModel):
    source_id: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "provider": settings.embedding_provider, "model": settings.embedding_model}


@app.post("/embed")
async def trigger_embed(req: EmbedRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_pending_chunks, req.source_id)
    return {"status": "accepted"}


@app.post("/embed/sync")
async def embed_sync(req: EmbedRequest):
    count = await process_pending_chunks(req.source_id)
    return {"embedded": count}
