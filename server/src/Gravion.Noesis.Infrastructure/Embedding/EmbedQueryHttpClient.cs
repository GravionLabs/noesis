using System.Net.Http.Json;

using Gravion.Noesis.Core.Abstractions;

using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.Infrastructure.Clients;

public class EmbedQueryHttpClient(HttpClient http, ILogger<EmbedQueryHttpClient> logger) : IEmbedQueryClient
{
    public async Task<EmbedQueryResult?> EmbedQueryAsync(string text, CancellationToken ct = default)
    {
        try
        {
            var response = await http.PostAsJsonAsync("/embed/query", new { text }, ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Embedder /embed/query returned {StatusCode}", response.StatusCode);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<EmbedQueryResponse>(ct);
            return result is null ? null : new EmbedQueryResult(result.Vector, result.Model);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to reach embedder for query embedding; falling back to FTS");
            return null;
        }
    }

    private sealed record EmbedQueryResponse(float[] Vector, string Model);
}
