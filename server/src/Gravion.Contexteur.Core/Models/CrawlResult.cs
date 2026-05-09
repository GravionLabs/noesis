namespace Gravion.Contexteur.Core.Abstractions;

public record CrawlResult(bool Success, int DocCount, string? Error);
