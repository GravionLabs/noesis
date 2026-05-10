namespace Gravion.Noesis.Core.Abstractions;

public interface IEmbedQueryClient
{
    /// <summary>Embeds a query text and returns the resulting vector, or null if the embedder is unavailable.</summary>
    Task<float[]?> EmbedQueryAsync(string text, CancellationToken ct = default);
}
