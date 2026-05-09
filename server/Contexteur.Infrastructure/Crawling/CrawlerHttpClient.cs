using Contexteur.Core.Interfaces;
using System.Net.Http.Json;

namespace Contexteur.Infrastructure.Crawling;

public class CrawlerHttpClient(HttpClient http) : ICrawlerClient
{
    public async Task<CrawlResult> StartCrawlAsync(Guid jobId, Guid sourceId, string sourceUrl, string sourceType, CancellationToken ct = default)
    {
        var response = await http.PostAsJsonAsync("/crawl", new
        {
            jobId,
            sourceId,
            url = sourceUrl,
            type = sourceType,
            callbackUrl = "/api/internal/crawl-completed"
        }, ct);

        if (!response.IsSuccessStatusCode)
            return new CrawlResult(false, 0, $"Crawler returned {response.StatusCode}");

        return new CrawlResult(true, 0, null);
    }
}
