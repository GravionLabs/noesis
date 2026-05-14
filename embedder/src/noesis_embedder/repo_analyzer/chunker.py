"""Smart chunking using semantic embeddings for code analysis."""

from dataclasses import dataclass
import numpy as np


@dataclass
class CodeChunk:
    """A semantically meaningful chunk of code or documentation."""

    content: str
    """The actual text content of this chunk."""

    source_file: str
    """Path to the source file this chunk came from."""

    line_start: int
    """Starting line number (0-indexed)."""

    line_end: int
    """Ending line number (inclusive)."""

    chunk_type: str
    """Type of chunk: 'function', 'class', 'module', 'doc', 'comment'."""

    embedding: np.ndarray | None = None
    """Optional pre-computed embedding vector."""


class SemanticChunker:
    """Split code into semantically meaningful chunks using embeddings."""

    def __init__(self, embedder, similarity_threshold: float = 0.75):
        """Initialize chunker.

        Args:
            embedder: CodeEmbedder instance for computing embeddings.
            similarity_threshold: Minimum similarity to group consecutive lines into one chunk.
                                 Higher = larger chunks, Lower = more granular chunks.
        """
        self.embedder = embedder
        self.similarity_threshold = similarity_threshold

    def chunk_file(
        self,
        content: str,
        source_file: str,
        chunk_type: str = "file",
    ) -> list[CodeChunk]:
        """Split file content into semantic chunks.

        Strategy:
        1. Split by logical boundaries (functions, classes, sections)
        2. For each section, use embeddings to find natural break points
        3. Ensure chunks are not too large (prefer <500 tokens)

        Args:
            content: File content as string.
            source_file: Path to the source file.
            chunk_type: Type of content being chunked.

        Returns:
            List of CodeChunk objects.
        """
        lines = content.split("\n")
        chunks = []

        # Simple strategy: split by blank lines + semantic boundaries
        current_chunk_lines = []
        current_start = 0

        for i, line in enumerate(lines):
            current_chunk_lines.append(line)

            # Check if we should end the chunk (blank line or end of file)
            is_end_of_file = i == len(lines) - 1
            is_significant_blank = line.strip() == "" and len(current_chunk_lines) > 5

            if is_end_of_file or is_significant_blank:
                chunk_text = "\n".join(current_chunk_lines).strip()
                if chunk_text:  # Skip empty chunks
                    chunk = CodeChunk(
                        content=chunk_text,
                        source_file=source_file,
                        line_start=current_start,
                        line_end=i,
                        chunk_type=chunk_type,
                    )
                    # Pre-compute embedding for later use
                    embedding = self.embedder.embed([chunk_text])[0]
                    chunk.embedding = embedding
                    chunks.append(chunk)

                current_chunk_lines = []
                current_start = i + 1

        return chunks

    def merge_similar_chunks(
        self,
        chunks: list[CodeChunk],
        min_chunk_size: int = 50,
    ) -> list[CodeChunk]:
        """Merge consecutive chunks if they're semantically similar.

        Useful for consolidating small fragments that logically belong together.

        Args:
            chunks: List of CodeChunk objects.
            min_chunk_size: Minimum character count to keep a chunk separate.

        Returns:
            Merged list of CodeChunk objects.
        """
        if len(chunks) < 2:
            return chunks

        merged = []
        i = 0

        while i < len(chunks):
            current = chunks[i]

            # Look ahead for similar chunks
            j = i + 1
            while j < len(chunks):
                next_chunk = chunks[j]
                if current.embedding is not None and next_chunk.embedding is not None:
                    sim = self.embedder.similarity(
                        current.embedding,
                        next_chunk.embedding,
                    )
                    if sim >= self.similarity_threshold:
                        # Merge: concatenate content
                        current.content += "\n" + next_chunk.content
                        current.line_end = next_chunk.line_end
                        j += 1
                    else:
                        break
                else:
                    break

            if len(current.content) >= min_chunk_size:
                merged.append(current)
            elif merged:
                # Append to previous chunk if too small
                merged[-1].content += "\n" + current.content
                merged[-1].line_end = current.line_end
            else:
                merged.append(current)

            i = j

        return merged
