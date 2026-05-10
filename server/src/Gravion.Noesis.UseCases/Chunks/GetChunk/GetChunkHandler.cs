using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;

namespace Gravion.Noesis.UseCases.Chunks.GetChunk;

public class GetChunkHandler(IChunkRepository chunks)
{
    private readonly IChunkRepository _chunks = Guard.Against.Null(chunks);

    public async Task<Result<ChunkResult>> Handle(GetChunkQuery query, CancellationToken ct)
    {
        Guard.Against.Default(query.ChunkId, nameof(query.ChunkId));

        var chunk = await _chunks.GetByIdAsync(query.ChunkId, ct);
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
