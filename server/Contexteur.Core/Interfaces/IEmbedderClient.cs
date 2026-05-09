namespace Contexteur.Core.Interfaces;

public interface IEmbedderClient
{
    Task<EmbedResult> StartEmbedAsync(Guid jobId, Guid sourceId, CancellationToken ct = default);
}

public record EmbedResult(bool Success, int ChunkCount, string? Error);
