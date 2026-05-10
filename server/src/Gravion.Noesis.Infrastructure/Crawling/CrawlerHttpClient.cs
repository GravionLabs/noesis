using System.Net.Http.Json;
using Ardalis.GuardClauses;

using Gravion.Noesis.Core.Abstractions;

namespace Gravion.Noesis.Infrastructure.Crawling;

public class CrawlerHttpClient(HttpClient http) : ICrawlerClient
{
    private readonly HttpClient _http = Guard.Against.Null(http);

    public async Task<CrawlResult> StartCrawlAsync(Guid jobId,
        Guid sourceId,
        string sourceUrl,
        string sourceType,
        CancellationToken ct = default)
    {
        var response = await _http.PostAsJsonAsync("/jobs/crawl",
            new
            {
                jobId,
                sourceId,
                url = sourceUrl,
                type = sourceType,
                callbackUrl = "/api/internal/crawl-completed"
            },
            ct);

        if (!response.IsSuccessStatusCode)
            return new CrawlResult(false, 0, $"Crawler returned {response.StatusCode}");

        return new CrawlResult(true, 0, null);
    }
}
