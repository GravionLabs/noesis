"""Test script for HuggingFace embeddings in repo analyzer."""

import asyncio
import sys
sys.path.insert(0, "src")

from noesis_embedder.repo_analyzer.code_embedder import CodeEmbedder
from noesis_embedder.repo_analyzer.chunker import SemanticChunker


async def test_embedder():
    """Test HuggingFace code embedder."""
    print("Initializing CodeEmbedder with bge-large-en-v1.5...")
    embedder = CodeEmbedder("bge-large-en-v1.5")
    
    # Test embedding
    texts = [
        "def hello_world(): print('Hello, World!')",
        "function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }",
        "This is a documentation string",
    ]
    
    print(f"\nEmbedding {len(texts)} texts...")
    embeddings = embedder.embed(texts)
    print(f"✅ Generated embeddings shape: {embeddings.shape}")
    
    # Test similarity
    sim = embedder.similarity(embeddings[0], embeddings[1])
    print(f"✅ Similarity between text 0 and 1: {sim:.4f}")
    
    # Test chunker
    print("\nInitializing SemanticChunker...")
    chunker = SemanticChunker(embedder, similarity_threshold=0.75)
    
    code = """
def fibonacci(n: int) -> int:
    \"\"\"Calculate fibonacci number.\"\"\"
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

def factorial(n: int) -> int:
    \"\"\"Calculate factorial.\"\"\"
    if n <= 1:
        return 1
    return n * factorial(n - 1)
"""
    
    print("Chunking sample code...")
    chunks = chunker.chunk_file(code, "test.py", "file")
    print(f"✅ Generated {len(chunks)} chunks")
    for i, chunk in enumerate(chunks):
        print(f"\nChunk {i}:")
        print(f"  Lines: {chunk.line_start}-{chunk.line_end}")
        print(f"  Content: {chunk.content[:50]}...")


if __name__ == "__main__":
    asyncio.run(test_embedder())
