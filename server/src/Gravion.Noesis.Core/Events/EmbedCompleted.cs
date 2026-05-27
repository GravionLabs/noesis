using MassTransit;

namespace Gravion.Noesis.Core.Events;

[EntityName("noesis.embed-completed")]
public record EmbedCompleted(Guid JobId, Guid SourceId, int ChunkCount)
{
    // Wolverine uses this property to correlate the message to the ImportJobSaga instance
    public Guid SagaId => JobId;
}
