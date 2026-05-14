"""HTTP API endpoints for repository analysis."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from noesis_embedder.repo_analyzer.code_embedder import CodeEmbedder, EmbeddingModel
from noesis_embedder.repo_analyzer.chunker import CodeChunk


router = APIRouter(prefix="/repo-analyzer", tags=["repo-analyzer"])


class EmbedRequest(BaseModel):
    """Request to embed text."""

    texts: list[str]
    model: EmbeddingModel = "bge-large-en-v1.5"


class EmbedResponse(BaseModel):
    """Response with embeddings."""

    embeddings: list[list[float]]
    model: str
    dimension: int


@router.post("/embed", response_model=EmbedResponse)
async def embed_texts(request: EmbedRequest) -> EmbedResponse:
    """Embed a list of texts using HuggingFace models.

    Args:
        request: List of texts to embed and model to use.

    Returns:
        Embeddings as list of vectors.
    """
    try:
        embedder = CodeEmbedder(request.model)
        embeddings = embedder.embed(request.texts)

        # Convert numpy array to list of lists
        embeddings_list = embeddings.tolist()

        return EmbedResponse(
            embeddings=embeddings_list,
            model=request.model,
            dimension=embedder.embedding_dim,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ChunkRequest(BaseModel):
    """Request to chunk code."""

    content: str
    source_file: str
    model: EmbeddingModel = "bge-large-en-v1.5"
    similarity_threshold: float = 0.75


class ChunkResponse(BaseModel):
    """Response with code chunks."""

    chunks: list[dict]
    count: int


@router.post("/chunk", response_model=ChunkResponse)
async def chunk_code(request: ChunkRequest) -> ChunkResponse:
    """Chunk code content using semantic embeddings.

    Args:
        request: Code content to chunk and configuration.

    Returns:
        List of semantic chunks.
    """
    try:
        embedder = CodeEmbedder(request.model)
        from noesis_embedder.repo_analyzer.chunker import SemanticChunker

        chunker = SemanticChunker(embedder, request.similarity_threshold)
        chunks = chunker.chunk_file(
            request.content,
            request.source_file,
            chunk_type="file",
        )

        # Convert chunks to JSON-serializable format
        chunks_json = [
            {
                "content": chunk.content,
                "source_file": chunk.source_file,
                "line_start": chunk.line_start,
                "line_end": chunk.line_end,
                "chunk_type": chunk.chunk_type,
            }
            for chunk in chunks
        ]

        return ChunkResponse(chunks=chunks_json, count=len(chunks_json))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "service": "repo-analyzer"}
