using MassTransit;

namespace Gravion.Noesis.UseCases.Crawling;

/// <summary>
/// Saga state for import orchestration. Persisted to database to track import job status across async operations.
/// Correlates by JobId which becomes the saga CorrelationId.
/// </summary>
public class ImportJobState : SagaStateMachineInstance
{
    // Required by ISaga interface
    public Guid CorrelationId { get; set; }

    // MassTransit state tracking (serializes current state name)
    public string? CurrentState { get; set; }

    // Saga state fields
    public Guid JobId { get; set; }
    public Guid SourceId { get; set; }
    public string ImporterType { get; set; } = "";

    // Job tracking
    public int DocCount { get; set; }
    public int ChunkCount { get; set; }
    public DateTime? StartedAt { get; set; }
}
