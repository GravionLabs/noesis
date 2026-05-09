namespace Contexteur.Core.Abstractions;

public interface ICrawlerClient
{
    Task<CrawlResult> StartCrawlAsync(Guid jobId, Guid sourceId, string sourceUrl, string sourceType, CancellationToken ct = default);
}

public record CrawlResult(bool Success, int DocCount, string? Error);
