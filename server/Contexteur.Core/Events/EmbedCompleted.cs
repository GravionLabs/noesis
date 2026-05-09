namespace Contexteur.Core.Events;

public record EmbedCompleted(Guid JobId, Guid SourceId, int ChunkCount)
{
    // Wolverine uses this property to correlate the message to a CrawlJobSaga instance
    public Guid SagaId => JobId;
}
