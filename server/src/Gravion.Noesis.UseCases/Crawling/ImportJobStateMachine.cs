using Gravion.Noesis.Core.Events;

using MassTransit;

namespace Gravion.Noesis.UseCases.Crawling;

/// <summary>
/// StateMachine saga for orchestrating the import pipeline:
/// StartImportSaga → (ImportCompleted | CrawlCompleted) → StartEmbedJob → EmbedCompleted → Done
///
/// The saga is long-running and persists state to database via EF Core.
/// Correlation is by JobId (becomes CorrelationId).
/// </summary>
public class ImportJobStateMachine : MassTransitStateMachine<ImportJobState>
{
    // States
    public State Initial { get; private set; } = null!;
    public State Importing { get; private set; } = null!;
    public State Embedding { get; private set; } = null!;
    public State Done { get; private set; } = null!;

    // Events
    public Event<StartImportSaga> StartImport { get; private set; } = null!;
    public Event<ImportCompleted> ImportComplete { get; private set; } = null!;
    public Event<CrawlCompleted> CrawlComplete { get; private set; } = null!;
    public Event<EmbedCompleted> EmbedComplete { get; private set; } = null!;

    public ImportJobStateMachine()
    {
        InstanceState(x => x.CurrentState);

        // Correlation: StartImportSaga triggers saga creation with JobId as CorrelationId
        Event(() => StartImport,
            x => x.CorrelateById(m => m.Message.JobId));

        // InProcess importers (llmstxt, github): ImportCompleted comes back immediately
        Event(() => ImportComplete,
            x => x.CorrelateById(m => m.Message.JobId));

        // External crawler importer: CrawlCompleted comes from RabbitMQ callback
        Event(() => CrawlComplete,
            x => x.CorrelateById(m => m.Message.JobId));

        // Embedder completes
        Event(() => EmbedComplete,
            x => x.CorrelateById(m => m.Message.JobId));

        // Transition: Initial → Importing (when saga starts)
        Initially(
            When(StartImport)
                .Then(context =>
                {
                    context.Instance.JobId = context.Data.JobId;
                    context.Instance.CorrelationId = context.Data.JobId;
                    context.Instance.SourceId = context.Data.SourceId;
                    context.Instance.ImporterType = context.Data.ImporterType;
                    context.Instance.StartedAt = DateTime.UtcNow;
                })
                .TransitionTo(Importing));

        // Transition: Importing → Embedding (on import complete, either via ImportCompleted or CrawlCompleted)
        During(Importing,
            When(ImportComplete)
                .Then(context =>
                {
                    context.Instance.DocCount = context.Data.DocCount;
                    context.Instance.ChunkCount = context.Data.ChunkCount;
                })
                .TransitionTo(Embedding)
                .Publish(context => new StartEmbedJob(context.Instance.JobId, context.Instance.SourceId)),
            When(CrawlComplete)
                .Then(context =>
                {
                    context.Instance.DocCount = context.Data.DocCount;
                    context.Instance.ChunkCount = context.Data.ChunkCount;
                })
                .TransitionTo(Embedding)
                .Publish(context => new StartEmbedJob(context.Instance.JobId, context.Instance.SourceId)));

        // Transition: Embedding → Done (on embed complete)
        During(Embedding,
            When(EmbedComplete)
                .TransitionTo(Done));

        // Final state: saga completes when entering Done
        SetCompletedWhenFinalized();
    }
}
