using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;
using Gravion.Contexteur.Core.Models;

using Microsoft.Extensions.Logging;

namespace Gravion.Contexteur.Infrastructure.Importers;

/// <summary>
///     Delegates crawling to the external Node.js Playwright crawler service.
///     Returns WaitForCallback=true because the crawler calls back asynchronously
///     via POST /api/internal/crawl-completed when done.
/// </summary>
public class CrawlerImporter(ICrawlerClient crawlerClient, ILogger<CrawlerImporter> logger) : IImporter
{
    public string ImporterType => "crawler";

    public async Task<ImportResult> ImportAsync(Source source, ImportContext context, CancellationToken ct = default)
    {
        logger.LogInformation("Triggering Node.js crawler for source {SourceId}", source.Id);

        var result = await crawlerClient.StartCrawlAsync(
            context.JobId,
            source.Id,
            source.Url,
            source.ImporterType,
            ct);

        if (!result.Success)
            return new ImportResult(false, 0, 0, result.Error);

        // The crawler is async — it will call back /api/internal/crawl-completed when done
        return new ImportResult(true, 0, 0, WaitForCallback: true);
    }
}
