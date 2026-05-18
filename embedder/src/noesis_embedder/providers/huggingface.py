"""HuggingFace local embedding provider using SentenceTransformer."""
from __future__ import annotations

import asyncio
import logging
from functools import lru_cache

import torch
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


def _get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


@lru_cache(maxsize=4)
def _load_model(model_name: str) -> SentenceTransformer:
    device = _get_device()
    logger.info("Loading SentenceTransformer model '%s' on device '%s'", model_name, device)
    model = SentenceTransformer(model_name, device=device)
    logger.info(
        "Model '%s' loaded — %d dimensions",
        model_name,
        model.get_sentence_embedding_dimension(),
    )
    return model


def get_dimensions(model_name: str) -> int:
    """Return the embedding dimensionality for the given model (loads model if needed)."""
    return _load_model(model_name).get_sentence_embedding_dimension()


async def embed(texts: list[str], model_name: str) -> list[list[float]]:
    """Embed *texts* using a locally loaded SentenceTransformer model.

    Runs ``model.encode()`` in the default thread-pool executor to avoid
    blocking the asyncio event loop on CPU-bound work.
    """
    model = _load_model(model_name)
    loop = asyncio.get_event_loop()
    vectors = await loop.run_in_executor(
        None,
        lambda: model.encode(texts, normalize_embeddings=True),
    )
    return [v.tolist() for v in vectors]
