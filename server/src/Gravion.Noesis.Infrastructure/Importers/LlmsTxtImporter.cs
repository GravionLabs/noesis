using System.Security.Cryptography;
using System.Text;
using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.Core.Models;

using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.Infrastructure.Importers;

/// <summary>
///     Imports documentation from an llms-full.txt file (https://llmstxt.org/).
///     The file is a single Markdown document with all docs inlined, split by H2 headings.
/// </summary>
public class LlmsTxtImporter(
    HttpClient http,
    IDocRepository docs,
    IChunkRepository chunks,
    ILogger<LlmsTxtImporter> logger) : IImporter
{
    private readonly HttpClient _http = Guard.Against.Null(http);
    private readonly IDocRepository _docs = Guard.Against.Null(docs);
    private readonly IChunkRepository _chunks = Guard.Against.Null(chunks);
    private readonly ILogger<LlmsTxtImporter> _logger = Guard.Against.Null(logger);

    private const int MaxChunkLength = 2000;
    public string ImporterType => "llmstxt";

    public async Task<Result<ImportResult>> ImportAsync(Source source, ImportContext context, CancellationToken ct = default)
    {
        _logger.LogInformation("Starting llms.txt import for source {SourceId} from {Url}", source.Id, source.Url);

        string markdown;
        try
        {
            markdown = await _http.GetStringAsync(source.Url, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch {Url}", source.Url);
            return Result.Error($"HTTP fetch failed: {ex.Message}");
        }

        // Delete existing data for idempotent re-imports (chunks first due to FK, then docs)
        await _chunks.DeleteBySourceAsync(source.Id, ct);
        await _docs.DeleteBySourceAsync(source.Id, ct);

        var sections = SplitIntoSections(markdown);
        var chunkCount = 0;

        var doc = await _docs.AddAsync(new Doc
            {
                SourceId = source.Id,
                Url = source.Url,
                Title = ExtractTitle(markdown),
                ContentMd = markdown,
                ContentHash = ComputeHash(markdown),
                IndexedAt = DateTime.UtcNow
            },
            ct);

        var chunkIndex = 0;
        foreach (var entities in sections
                     .Select(section => SplitIntoChunks(section.Content, section.Heading, section.HeadingPath))
                     .Select(sectionChunks => sectionChunks.Select(c => new Chunk
                         {
                             DocId = doc.Id,
                             SourceId = source.Id,
                             Content = c.Content,
                             Heading = c.Heading,
                             HeadingPath = c.HeadingPath,
                             ChunkIndex = chunkIndex++,
                             TokenCount = EstimateTokens(c.Content)
                         })
                         .ToList()))
        {
            await _chunks.AddRangeAsync(entities, ct);
            chunkCount += entities.Count;
        }

        _logger.LogInformation("Completed llms.txt import: 1 doc, {ChunkCount} chunks", chunkCount);
        return new ImportResult(true, 1, chunkCount);
    }

    private static string? ExtractTitle(string markdown)
    {
        var firstLine = markdown.Split('\n', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        return firstLine?.TrimStart('#').Trim();
    }

    private static string ComputeHash(string content)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(content));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static List<Section> SplitIntoSections(string markdown)
    {
        var sections = new List<Section>();
        var lines = markdown.Split('\n');
        var currentHeading = string.Empty;
        var currentHeadingPath = Array.Empty<string>();
        var currentContent = new StringBuilder();

        foreach (var line in lines)
        {
            if (line.StartsWith("## "))
            {
                if (currentContent.Length > 0)
                    sections.Add(new Section(currentHeading, currentHeadingPath, currentContent.ToString().Trim()));

                currentHeading = line[3..].Trim();
                currentHeadingPath = [currentHeading];
                currentContent.Clear();
            }
            else
                currentContent.AppendLine(line);
        }

        if (currentContent.Length > 0)
            sections.Add(new Section(currentHeading, currentHeadingPath, currentContent.ToString().Trim()));

        return sections;
    }

    private static List<ChunkData> SplitIntoChunks(string content, string heading, string[] headingPath)
    {
        if (content.Length <= MaxChunkLength)
            return [new ChunkData(heading, headingPath, content)];

        var result = new List<ChunkData>();
        var paragraphs = content.Split("\n\n", StringSplitOptions.RemoveEmptyEntries);
        var current = new StringBuilder();

        foreach (var para in paragraphs)
        {
            if (current.Length + para.Length + 2 > MaxChunkLength && current.Length > 0)
            {
                result.Add(new ChunkData(heading, headingPath, current.ToString().Trim()));
                current.Clear();
            }

            if (para.Length > MaxChunkLength)
            {
                // Paragraph alone exceeds limit — split at sentence boundaries
                foreach (var sentence in SplitAtSentences(para, MaxChunkLength))
                {
                    if (current.Length + sentence.Length + 1 > MaxChunkLength && current.Length > 0)
                    {
                        result.Add(new ChunkData(heading, headingPath, current.ToString().Trim()));
                        current.Clear();
                    }

                    current.Append(sentence).Append(' ');
                }
            }
            else
                current.Append(para).Append("\n\n");
        }

        if (current.Length > 0)
            result.Add(new ChunkData(heading, headingPath, current.ToString().Trim()));

        return result.Count > 0
            ? result
            : [new ChunkData(heading, headingPath, content[..Math.Min(content.Length, MaxChunkLength)])];
    }

    private static IEnumerable<string> SplitAtSentences(string text, int maxLength)
    {
        var sentences = text.Split(". ", StringSplitOptions.RemoveEmptyEntries);
        var current = new StringBuilder();
        foreach (var s in sentences)
        {
            if (current.Length + s.Length + 2 > maxLength && current.Length > 0)
            {
                yield return current.ToString().Trim();
                current.Clear();
            }

            current.Append(s).Append(". ");
        }

        if (current.Length > 0)
            yield return current.ToString().Trim();
    }

    private static int EstimateTokens(string content) => content.Length / 4;

    private record Section(string Heading, string[] HeadingPath, string Content);

    private record ChunkData(string Heading, string[] HeadingPath, string Content);
}
