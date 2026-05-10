using System.Text.Json;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.Core.Models;

using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.Infrastructure.Importers;

/// <summary>
///     Parses the SHORT llms.txt metadata file (https://llmstxt.org/).
///     This is NOT llms-full.txt — it is the compact index file containing
///     title, description, and categorised links for crawling guidance.
///     Parsed metadata is stored as JSON in <see cref="Source.Config" />.
///     No docs or chunks are created by this importer.
/// </summary>
public class LlmsMetaTxtImporter(
    HttpClient http,
    ISourceRepository sources,
    ILogger<LlmsMetaTxtImporter> logger) : IImporter
{
    public string ImporterType => "llmstxt-meta";

    public async Task<ImportResult> ImportAsync(Source source, ImportContext context, CancellationToken ct = default)
    {
        logger.LogInformation("Starting llms.txt metadata import for source {SourceId} from {Url}",
            source.Id,
            source.Url);

        string content;
        try
        {
            content = await http.GetStringAsync(source.Url, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch {Url}", source.Url);
            return new ImportResult(false, 0, 0, $"HTTP fetch failed: {ex.Message}");
        }

        var metadata = Parse(content);
        source.Config = JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = false });
        await sources.UpdateAsync(source, ct);

        logger.LogInformation(
            "Completed llms.txt metadata import: title={Title}, {ImportantCount} important links, {OptionalCount} optional links",
            metadata.Title,
            metadata.ImportantLinks.Count,
            metadata.OptionalLinks.Count);

        return new ImportResult(true, 0, 0);
    }

    internal static LlmsMetadata Parse(string content)
    {
        var lines = content.Split('\n');

        string? title = null;
        string? description = null;
        var importantLinks = new List<LlmsLink>();
        var optionalLinks = new List<LlmsLink>();

        var inOptionalSection = false;

        foreach (var rawLine in lines)
        {
            var line = rawLine.TrimEnd();

            if (line.StartsWith("# "))
            {
                title = line[2..].Trim();
                inOptionalSection = false;
                continue;
            }

            if (line.StartsWith("## "))
            {
                var sectionName = line[3..].Trim();
                inOptionalSection = string.Equals(sectionName, "Optional", StringComparison.OrdinalIgnoreCase);
                continue;
            }

            if (line.StartsWith("> "))
            {
                description = (description is null ? "" : description + " ") + line[2..].Trim();
                continue;
            }

            if (line.StartsWith("- "))
            {
                var link = ParseLink(line[2..]);
                if (link is not null)
                    (inOptionalSection ? optionalLinks : importantLinks).Add(link);
            }
        }

        return new LlmsMetadata(
            title ?? "",
            description?.Trim() ?? "",
            importantLinks,
            optionalLinks);
    }

    private static LlmsLink? ParseLink(string text)
    {
        // Pattern: [Label](url): description
        // or:      [Label](url)
        var mdLinkEnd = text.IndexOf("](", StringComparison.Ordinal);
        if (mdLinkEnd < 0)
            return null;

        var labelStart = text.IndexOf('[');
        if (labelStart < 0)
            return null;

        var label = text[(labelStart + 1)..mdLinkEnd];

        var urlStart = mdLinkEnd + 2;
        var urlEnd = text.IndexOf(')', urlStart);
        if (urlEnd < 0)
            return null;

        var url = text[urlStart..urlEnd];

        var description = "";
        if (urlEnd + 1 < text.Length)
            description = text[(urlEnd + 1)..].TrimStart(':', ' ');

        return new LlmsLink(url, label, description);
    }
}

public record LlmsMetadata(
    string Title,
    string Description,
    List<LlmsLink> ImportantLinks,
    List<LlmsLink> OptionalLinks);

public record LlmsLink(string Url, string Label, string Description);
