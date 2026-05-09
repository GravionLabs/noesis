namespace Gravion.Contexteur.Core.Abstractions;

public interface IEmbedderClient
{
    Task<EmbedResult> StartEmbedAsync(Guid jobId, Guid sourceId, CancellationToken ct = default);
}
