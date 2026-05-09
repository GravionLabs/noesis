using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Contexteur.Core.Abstractions;

namespace Gravion.Contexteur.UseCases.Chunks.GetChunk;

public class GetChunkHandler(IChunkRepository chunks)
{
    public async Task<Result<ChunkResult>> Handle(GetChunkQuery query, CancellationToken ct)
    {
        Guard.Against.Default(query.ChunkId, nameof(query.ChunkId));

        var chunk = await chunks.GetByIdAsync(query.ChunkId, ct);
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
