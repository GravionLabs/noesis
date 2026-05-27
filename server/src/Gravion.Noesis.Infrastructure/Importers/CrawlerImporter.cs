using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.Core.Events;
using Gravion.Noesis.Core.Models;

using MassTransit;

using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.Infrastructure.Importers;

/// <summary>
///     Delegates crawling to the external Node.js Playwright crawler service.
///     Returns WaitForCallback=true because the crawler publishes CrawlCompleted to RabbitMQ when done.
/// </summary>
public class CrawlerImporter(IPublishEndpoint publishEndpoint, ILogger<CrawlerImporter> logger) : IImporter
{
    private readonly IPublishEndpoint _publishEndpoint = Guard.Against.Null(publishEndpoint);
    private readonly ILogger<CrawlerImporter> _logger = Guard.Against.Null(logger);

    public string ImporterType => "crawler";

    public async Task<Result<ImportResult>> ImportAsync(Source source, ImportContext context, CancellationToken ct = default)
    {
        Guard.Against.Null(source);
        Guard.Against.Null(context);

        _logger.LogInformation("Publishing StartCrawlJob for source {SourceId}", source.Id);

        await _publishEndpoint.Publish(
            new StartCrawlJob(context.JobId, source.Id, source.Url, source.ImporterType, source.Config),
            ct);

        // The crawler is async — it will publish CrawlCompleted to RabbitMQ when done
        return new ImportResult(true, 0, 0, WaitForCallback: true);
    }
}
