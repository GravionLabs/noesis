using MassTransit;

namespace Gravion.Noesis.Core.Events;

[EntityName("noesis.start-crawl-job")]
public record StartCrawlJob(Guid JobId, Guid SourceId, string Url, string Type, string? Config = null);
