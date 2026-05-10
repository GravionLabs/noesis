namespace Gravion.Noesis.UseCases.Chunks.GetChunk;

public record GetChunkQuery(Guid ChunkId);

public record ChunkResult(
    Guid Id,
    Guid DocId,
    Guid SourceId,
    string SourceName,
    string DocUrl,
    string Content,
    string? Heading,
    string[]? HeadingPath,
    int ChunkIndex);
