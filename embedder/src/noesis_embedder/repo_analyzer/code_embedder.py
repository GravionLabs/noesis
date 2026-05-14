"""HuggingFace semantic embeddings for code analysis."""

from typing import Literal
import numpy as np
from sentence_transformers import SentenceTransformer


EmbeddingModel = Literal["bge-large-en-v1.5", "e5-large-v2", "nomic-embed-text"]


class CodeEmbedder:
    """Generate semantic embeddings for code snippets using HuggingFace models."""

    def __init__(self, model: EmbeddingModel = "bge-large-en-v1.5"):
        """Initialize embedder with specified HuggingFace model.

        Args:
            model: HuggingFace model to use for embeddings.
                   - 'bge-large-en-v1.5': Best quality (1024 dims)
                   - 'e5-large-v2': Stable & reliable (1024 dims)
                   - 'nomic-embed-text': Fast & lightweight (768 dims)
        """
        model_map = {
            "bge-large-en-v1.5": "BAAI/bge-large-en-v1.5",
            "e5-large-v2": "intfloat/e5-large-v2",
            "nomic-embed-text": "nomic-ai/nomic-embed-text-v1.5",
        }
        self.model_name = model_map[model]
        self.model = SentenceTransformer(self.model_name)
        self.embedding_dim = self.model.get_embedding_dimension()

    def embed(self, texts: list[str]) -> np.ndarray:
        """Embed a list of texts.

        Args:
            texts: List of text snippets (code, docs, etc.)

        Returns:
            NumPy array of shape (len(texts), embedding_dim) with normalized embeddings.
        """
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings

    def similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Compute cosine similarity between two embeddings.

        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector

        Returns:
            Cosine similarity score (0.0 to 1.0)
        """
        return float(np.dot(embedding1, embedding2))
