using System.Text;
using System.Text.Json;
using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.Core.Models;

using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.Infrastructure.Importers;

/// <summary>
///     Fetches a package README from the npm registry and stores it as searchable chunks.
///     Source URL must be the npm registry JSON endpoint: <c>https://registry.npmjs.org/&lt;package-name&gt;</c>
/// </summary>
public class NpmReadmeImporter(
    HttpClient http,
    IDocRepository docs,
    IChunkRepository chunks,
    ILogger<NpmReadmeImporter> logger) : IImporter
{
    private readonly HttpClient _http = Guard.Against.Null(http);
    private readonly IDocRepository _docs = Guard.Against.Null(docs);
    private readonly IChunkRepository _chunks = Guard.Against.Null(chunks);
    private readonly ILogger<NpmReadmeImporter> _logger = Guard.Against.Null(logger);

    private const int MaxChunkLength = 2000;

    public string ImporterType => "npm-readme";

    public async Task<Result<ImportResult>> ImportAsync(Source source, ImportContext context, CancellationToken ct = default)
    {
        _logger.LogInformation("Starting npm-readme import for {Url}", source.Url);

        string json;
        try
        {
            // npm registry requires Accept header to return full JSON (not packument)
            using var request = new HttpRequestMessage(HttpMethod.Get, source.Url);
            request.Headers.Add("Accept", "application/json");
            var response = await _http.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
            json = await response.Content.ReadAsStringAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch {Url}", source.Url);
            return Result.Error($"HTTP fetch failed: {ex.Message}");
        }

        using var jsonDoc = JsonDocument.Parse(json);
        var root = jsonDoc.RootElement;

        var name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "";
        var description = root.TryGetProperty("description", out var descProp) ? descProp.GetString() ?? "" : "";
        var readme = root.TryGetProperty("readme", out var readmeProp) ? readmeProp.GetString() ?? "" : "";

        if (string.IsNullOrWhiteSpace(readme))
        {
            _logger.LogWarning("No README found in npm package {Name}", name);
            return Result.Error($"No README found in npm package '{name}'");
        }

        await _chunks.DeleteBySourceAsync(source.Id, ct);
        await _docs.DeleteBySourceAsync(source.Id, ct);

        var title = string.IsNullOrEmpty(description) ? name : $"{name} — {description}";
        var dbDoc = await _docs.AddAsync(new Doc
            {
                SourceId = source.Id,
                Url = source.Url,
                Title = title,
                IndexedAt = DateTime.UtcNow
            },
            ct);

        var chunkTexts = ChunkMarkdown(readme);
        var chunkIndex = 0;
        var entities = chunkTexts.Select(c => new Chunk
            {
                DocId = dbDoc.Id,
                SourceId = source.Id,
                Content = c,
                Heading = null,
                HeadingPath = [],
                ChunkIndex = chunkIndex++,
                TokenCount = c.Length / 4
            })
            .ToList();

        await _chunks.AddRangeAsync(entities, ct);

        _logger.LogInformation("Completed npm-readme import: 1 doc, {ChunkCount} chunks for {Name}",
            entities.Count, name);
        return new ImportResult(true, 1, entities.Count);
    }

    private static List<string> ChunkMarkdown(string markdown)
    {
        var result = new List<string>();
        var buffer = new StringBuilder();

        foreach (var line in markdown.Split('\n'))
        {
            if (buffer.Length + line.Length + 1 > MaxChunkLength && buffer.Length > 50)
            {
                result.Add(buffer.ToString().Trim());
                buffer.Clear();
            }

            buffer.AppendLine(line);
        }

        var last = buffer.ToString().Trim();
        if (last.Length > 50) result.Add(last);

        return result;
    }
}
