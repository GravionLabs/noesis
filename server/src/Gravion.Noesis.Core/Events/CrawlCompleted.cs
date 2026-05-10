namespace Gravion.Noesis.Core.Events;

public record CrawlCompleted(Guid JobId, Guid SourceId, int DocCount)
{
    // Wolverine uses this property to correlate the message to the ImportJobSaga instance
    public Guid SagaId => JobId;
}
