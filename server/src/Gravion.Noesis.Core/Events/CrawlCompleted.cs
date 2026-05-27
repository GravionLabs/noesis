using MassTransit;

namespace Gravion.Noesis.Core.Events;

[EntityName("noesis.crawl-completed")]
public record CrawlCompleted(Guid JobId, Guid SourceId, int DocCount, int ChunkCount)
{
    // MassTransit uses this property to correlate the message to the saga instance
    public Guid SagaId => JobId;
}
