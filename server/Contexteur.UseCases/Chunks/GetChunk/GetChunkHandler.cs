using Contexteur.Core.Interfaces;

namespace Contexteur.UseCases.Chunks.GetChunk;

public class GetChunkHandler(IChunkRepository chunks)
{
    public async Task<ChunkResult?> Handle(GetChunkQuery query, CancellationToken ct)
    {
        var chunk = await chunks.GetByIdAsync(query.ChunkId, ct);
        if (chunk is null) return null;

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
