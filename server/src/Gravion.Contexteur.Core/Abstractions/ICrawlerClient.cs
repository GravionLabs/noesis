namespace Gravion.Contexteur.Core.Abstractions;

public interface ICrawlerClient
{
    Task<CrawlResult> StartCrawlAsync(Guid jobId,
        Guid sourceId,
        string sourceUrl,
        string sourceType,
        CancellationToken ct = default);
}
