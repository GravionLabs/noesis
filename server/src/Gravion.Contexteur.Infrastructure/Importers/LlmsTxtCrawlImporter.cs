using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;
using Gravion.Contexteur.Core.Models;

using Microsoft.Extensions.Logging;

namespace Gravion.Contexteur.Infrastructure.Importers;

/// <summary>
///     Fetches a SHORT llms.txt file, extracts the linked pages, and delegates
///     Playwright crawling to the Node.js crawler service via POST /jobs/crawl-llmstxt.
///     Returns WaitForCallback=true — the Node crawler calls back asynchronously via
///     POST /api/internal/crawl-completed when all pages have been indexed.
/// </summary>
/// <remarks>
///     The source URL must point to a SHORT llms.txt file (not llms-full.txt).
///     Set <c>includeOptional: true</c> in <see cref="Source.Config" /> JSON to also
///     crawl pages listed under the <c>## Optional</c> section.
/// </remarks>
public class LlmsTxtCrawlImporter(HttpClient http, ILogger<LlmsTxtCrawlImporter> logger) : IImporter
{
    public string ImporterType => "llmstxt-crawl";

    public async Task<ImportResult> ImportAsync(Source source, ImportContext context, CancellationToken ct = default)
    {
        logger.LogInformation(
            "Triggering llms.txt sub-page crawl for source {SourceId} from {Url}",
            source.Id,
            source.Url);

        var includeOptional = false;
        if (!string.IsNullOrEmpty(source.Config))
        {
            try
            {
                var config = JsonSerializer.Deserialize<LlmsTxtCrawlConfig>(
                    source.Config,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                includeOptional = config?.IncludeOptional ?? false;
            }
            catch (JsonException)
            {
                logger.LogWarning("Could not parse source.Config for source {SourceId} — using defaults", source.Id);
            }
        }

        var response = await http.PostAsJsonAsync(
            "/jobs/crawl-llmstxt",
            new
            {
                jobId = context.JobId,
                sourceId = source.Id,
                url = source.Url,
                includeOptional,
            },
            ct);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            logger.LogError("Crawler returned {StatusCode}: {Error}", response.StatusCode, error);
            return new ImportResult(false, 0, 0, $"Crawler returned {response.StatusCode}");
        }

        return new ImportResult(true, 0, 0, WaitForCallback: true);
    }
}

internal sealed record LlmsTxtCrawlConfig(
    [property: JsonPropertyName("includeOptional")] bool IncludeOptional = false);
