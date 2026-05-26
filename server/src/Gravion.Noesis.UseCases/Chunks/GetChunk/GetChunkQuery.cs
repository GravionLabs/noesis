using Ardalis.Result;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Chunks.GetChunk;

public record GetChunkQuery(Guid ChunkId) : IQuery<Result<ChunkResult>>;

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
