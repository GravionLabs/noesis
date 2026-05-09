namespace Gravion.Contexteur.Core.Events;

public record CrawlCompleted(Guid JobId, Guid SourceId, int DocCount)
{
    // Wolverine uses this property to correlate the message to a CrawlJobSaga instance
    public Guid SagaId => JobId;
}
