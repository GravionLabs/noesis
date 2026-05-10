using System.Text;
using System.Text.Json;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.Core.Models;

using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.Infrastructure.Importers;

/// <summary>
///     Imports an OpenAPI specification (JSON format) and stores each operation as a searchable chunk.
///     Source URL must point to an OpenAPI JSON spec (e.g., <c>https://api.example.com/openapi.json</c>).
/// </summary>
/// <remarks>
///     YAML specs are not yet supported. Convert to JSON first or add YamlDotNet dependency.
///     Each HTTP operation (GET /path, POST /path, etc.) becomes one chunk containing
///     the method, path, summary, description and parameter documentation.
/// </remarks>
public class OpenApiImporter(
    HttpClient http,
    IDocRepository docs,
    IChunkRepository chunks,
    ILogger<OpenApiImporter> logger) : IImporter
{
    private static readonly HashSet<string> HttpMethods =
        ["get", "post", "put", "patch", "delete", "head", "options"];

    public string ImporterType => "openapi";

    public async Task<ImportResult> ImportAsync(Source source, ImportContext context, CancellationToken ct = default)
    {
        logger.LogInformation("Starting OpenAPI import for {Url}", source.Url);

        string json;
        try
        {
            json = await http.GetStringAsync(source.Url, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch {Url}", source.Url);
            return new ImportResult(false, 0, 0, $"HTTP fetch failed: {ex.Message}");
        }

        using var jsonDoc = JsonDocument.Parse(json);
        var root = jsonDoc.RootElement;

        var title = GetString(root, "info", "title") ?? source.Url;

        await chunks.DeleteBySourceAsync(source.Id, ct);
        await docs.DeleteBySourceAsync(source.Id, ct);

        var dbDoc = await docs.AddAsync(new Doc
            {
                SourceId = source.Id,
                Url = source.Url,
                Title = title,
                IndexedAt = DateTime.UtcNow
            },
            ct);

        var chunkEntities = new List<Chunk>();
        var chunkIndex = 0;

        if (root.TryGetProperty("paths", out var paths))
        {
            foreach (var pathItem in paths.EnumerateObject())
            {
                var path = pathItem.Name;

                foreach (var methodItem in pathItem.Value.EnumerateObject())
                {
                    if (!HttpMethods.Contains(methodItem.Name.ToLowerInvariant()))
                        continue;

                    var method = methodItem.Name.ToUpperInvariant();
                    var op = methodItem.Value;
                    var content = BuildOperationChunk(method, path, op);

                    if (content.Length < 10)
                        continue;

                    chunkEntities.Add(new Chunk
                    {
                        DocId = dbDoc.Id,
                        SourceId = source.Id,
                        Content = content,
                        Heading = $"{method} {path}",
                        HeadingPath = [path, method],
                        ChunkIndex = chunkIndex++,
                        TokenCount = content.Length / 4
                    });
                }
            }
        }

        if (chunkEntities.Count > 0)
            await chunks.AddRangeAsync(chunkEntities, ct);

        logger.LogInformation("Completed OpenAPI import: 1 doc, {ChunkCount} operation chunks for {Title}",
            chunkEntities.Count, title);
        return new ImportResult(true, 1, chunkEntities.Count);
    }

    private static string BuildOperationChunk(string method, string path, JsonElement op)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"## {method} {path}");

        var summary = GetStringDirect(op, "summary");
        if (!string.IsNullOrEmpty(summary)) sb.AppendLine($"**Summary:** {summary}");

        var operationId = GetStringDirect(op, "operationId");
        if (!string.IsNullOrEmpty(operationId)) sb.AppendLine($"**Operation ID:** {operationId}");

        var description = GetStringDirect(op, "description");
        if (!string.IsNullOrEmpty(description)) sb.AppendLine().AppendLine(description);

        if (op.TryGetProperty("parameters", out var parameters))
        {
            sb.AppendLine().AppendLine("**Parameters:**");
            foreach (var param in parameters.EnumerateArray())
            {
                var paramName = GetStringDirect(param, "name") ?? "?";
                var paramIn = GetStringDirect(param, "in") ?? "?";
                var paramDesc = GetStringDirect(param, "description") ?? "";
                var required = param.TryGetProperty("required", out var req) && req.GetBoolean();
                sb.AppendLine($"- `{paramName}` ({paramIn}{(required ? ", required" : "")}): {paramDesc}");
            }
        }

        if (op.TryGetProperty("requestBody", out var requestBody))
        {
            var bodyDesc = GetString(requestBody, "description");
            if (!string.IsNullOrEmpty(bodyDesc)) sb.AppendLine().AppendLine($"**Request body:** {bodyDesc}");
        }

        return sb.ToString().Trim();
    }

    private static string? GetString(JsonElement root, params string[] path)
    {
        var current = root;
        foreach (var key in path)
        {
            if (!current.TryGetProperty(key, out current)) return null;
        }

        return current.ValueKind == JsonValueKind.String ? current.GetString() : null;
    }

    private static string? GetStringDirect(JsonElement element, string key)
    {
        if (!element.TryGetProperty(key, out var prop)) return null;
        return prop.ValueKind == JsonValueKind.String ? prop.GetString() : null;
    }
}
