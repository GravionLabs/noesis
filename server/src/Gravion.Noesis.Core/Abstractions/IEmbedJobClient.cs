namespace Gravion.Noesis.Core.Abstractions;

/// <summary>Triggers the embedder to process unembedded chunks for a source (fire-and-forget).</summary>
public interface IEmbedJobClient
{
    /// <summary>
    ///     Sends an async embed request to the embedder. Returns immediately after the request is accepted (202).
    ///     The embedder will call back via <c>POST /api/internal/embed-completed</c> when done.
    /// </summary>
    Task TriggerAsync(Guid jobId, Guid sourceId, CancellationToken ct = default);
}
