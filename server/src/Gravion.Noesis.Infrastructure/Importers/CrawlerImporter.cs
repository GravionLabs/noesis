using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.Core.Models;

using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.Infrastructure.Importers;

/// <summary>
///     Delegates crawling to the external Node.js Playwright crawler service.
///     Returns WaitForCallback=true because the crawler calls back asynchronously
///     via POST /api/internal/crawl-completed when done.
/// </summary>
public class CrawlerImporter(ICrawlerClient crawlerClient, ILogger<CrawlerImporter> logger) : IImporter
{
    private readonly ICrawlerClient _crawlerClient = Guard.Against.Null(crawlerClient);
    private readonly ILogger<CrawlerImporter> _logger = Guard.Against.Null(logger);

    public string ImporterType => "crawler";

    public async Task<Result<ImportResult>> ImportAsync(Source source, ImportContext context, CancellationToken ct = default)
    {
        Guard.Against.Null(source);
        Guard.Against.Null(context);

        _logger.LogInformation("Triggering Node.js crawler for source {SourceId}", source.Id);

        var result = await _crawlerClient.StartCrawlAsync(
            context.JobId,
            source.Id,
            source.Url,
            source.ImporterType,
            ct);

        if (!result.Success)
            return Result.Error(result.Error ?? "Crawler failed");

        // The crawler is async — it will call back /api/internal/crawl-completed when done
        return new ImportResult(true, 0, 0, WaitForCallback: true);
    }
}
