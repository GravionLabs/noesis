using Contexteur.Core.Interfaces;
using System.Net.Http.Json;

namespace Contexteur.Infrastructure.Clients;

public class EmbedderHttpClient(HttpClient http) : IEmbedderClient
{
    public async Task<EmbedResult> StartEmbedAsync(Guid jobId, Guid sourceId, CancellationToken ct = default)
    {
        var response = await http.PostAsJsonAsync("/embed", new
        {
            jobId,
            sourceId,
            callbackUrl = "/api/internal/embed-completed"
        }, ct);

        if (!response.IsSuccessStatusCode)
            return new EmbedResult(false, 0, $"Embedder returned {response.StatusCode}");

        return new EmbedResult(true, 0, null);
    }
}
