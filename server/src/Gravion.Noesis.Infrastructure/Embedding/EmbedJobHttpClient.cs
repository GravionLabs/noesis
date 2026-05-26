using System.Net.Http.Json;

using Gravion.Noesis.Core.Abstractions;

using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.Infrastructure.Clients;

public class EmbedJobHttpClient(HttpClient http, ILogger<EmbedJobHttpClient> logger) : IEmbedJobClient
{
    public async Task TriggerAsync(Guid jobId, Guid sourceId, CancellationToken ct = default)
    {
        try
        {
            var response = await http.PostAsJsonAsync(
                "/embed",
                new { job_id = jobId.ToString(), source_id = sourceId.ToString() },
                ct);

            if (!response.IsSuccessStatusCode)
                logger.LogError("Embedder /embed returned {StatusCode} for job {JobId}", response.StatusCode, jobId);
            else
                logger.LogInformation("Embed job {JobId} triggered (async)", jobId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to trigger embedder for job {JobId}", jobId);
        }
    }
}
