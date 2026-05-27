namespace Gravion.Noesis.Core.Events;

public record StartCrawlJob(Guid JobId, Guid SourceId, string Url, string Type, string? Config = null);
