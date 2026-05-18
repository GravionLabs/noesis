namespace Gravion.Noesis.Core.Abstractions;

/// <summary>Result from the embedder containing both the query vector and the model used to generate it.</summary>
public sealed record EmbedQueryResult(float[] Vector, string Model);

public interface IEmbedQueryClient
{
    /// <summary>Embeds a query text and returns the resulting vector + model name, or null if the embedder is unavailable.</summary>
    Task<EmbedQueryResult?> EmbedQueryAsync(string text, CancellationToken ct = default);
}
