using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Chunks.GetChunk;

public class GetChunkHandler(IChunkRepository chunks) : IQueryHandler<GetChunkQuery, Result<ChunkResult>>
{
    private readonly IChunkRepository _chunks = Guard.Against.Null(chunks);

    public async Task<Result<ChunkResult>> HandleAsync(GetChunkQuery query, CancellationToken cancellationToken = default)
    {
        Guard.Against.Default(query.ChunkId, nameof(query.ChunkId));

        var chunk = await _chunks.GetByIdAsync(query.ChunkId, cancellationToken);
        if (chunk is null)
            return Result.NotFound();

        return new ChunkResult(
            chunk.Id,
            chunk.DocId,
            chunk.SourceId,
            chunk.Doc.Source.Name,
            chunk.Doc.Url,
            chunk.Content,
            chunk.Heading,
            chunk.HeadingPath,
            chunk.ChunkIndex);
    }
}
