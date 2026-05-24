using System.Diagnostics.CodeAnalysis;

using Gravion.Noesis.Core.Events;

using MassTransit;

namespace Gravion.Noesis.UseCases.Crawling;

/// <summary>
///     StateMachine saga for orchestrating the import pipeline:
///     StartImportSaga → (ImportCompleted | CrawlCompleted) → StartEmbedJob → EmbedCompleted → Done
///     The saga is long-running and persists state to the database via EF Core.
///     Correlation is by JobId (becomes CorrelationId).
/// </summary>
[SuppressMessage("ReSharper", "ClassNeverInstantiated.Global")]
[SuppressMessage("ReSharper", "MemberCanBePrivate.Global")]
[SuppressMessage("ReSharper", "ReplaceAutoPropertyWithComputedProperty")]
public class ImportJobStateMachine : MassTransitStateMachine<ImportJobState>
{
    public ImportJobStateMachine()
    {
        InstanceState(x => x.CurrentState);

        // Correlation: StartImportSaga triggers saga creation with JobId as CorrelationId
        Event(() => StartImport,
            x => x.CorrelateById(m => m.Message.JobId));

        // InProcess importers (llmstxt, github): ImportCompleted comes back immediately
        Event(() => ImportCompleted,
            x => x.CorrelateById(m => m.Message.JobId));

        // External crawler importer: CrawlCompleted comes from RabbitMQ callback
        Event(() => CrawlCompleted,
            x => x.CorrelateById(m => m.Message.JobId));

        // Embedder completes
        Event(() => EmbedCompleted,
            x => x.CorrelateById(m => m.Message.JobId));

        // Transition: Initial → Importing (when saga starts)
        Initially(
            When(StartImport)
                .Then(context =>
                {
                    context.Saga.JobId = context.Message.JobId;
                    context.Saga.CorrelationId = context.Message.JobId;
                    context.Saga.SourceId = context.Message.SourceId;
                    context.Saga.ImporterType = context.Message.ImporterType;
                    context.Saga.StartedAt = DateTime.UtcNow;
                })
                .TransitionTo(Importing));

        // Transition: Importing → Embedding (on import complete, either via ImportCompleted or CrawlCompleted)
        During(Importing,
            When(ImportCompleted)
                .Then(context =>
                {
                    context.Saga.DocCount = context.Message.DocCount;
                    context.Saga.ChunkCount = context.Message.ChunkCount;
                })
                .TransitionTo(Embedding)
                .Publish(context => new StartEmbedJob(context.Saga.JobId, context.Saga.SourceId)),
            When(CrawlCompleted)
                .Then(context =>
                {
                    context.Saga.DocCount = context.Message.DocCount;
                    context.Saga.ChunkCount = context.Message.ChunkCount;
                })
                .TransitionTo(Embedding)
                .Publish(context => new StartEmbedJob(context.Saga.JobId, context.Saga.SourceId)));

        // Transition: Embedding → Done (on embed complete)
        During(Embedding,
            When(EmbedCompleted)
                .TransitionTo(Done));

        // Keep saga rows for diagnostics/audit even after reaching Done.
        SetCompleted((ImportJobState _) => Task.FromResult(false));
    }

    // States
    public State Importing { get; } = null!;
    public State Embedding { get; } = null!;
    public State Done { get; } = null!;

    // Events
    public Event<StartImportSaga> StartImport { get; } = null!;
    public Event<ImportCompleted> ImportCompleted { get; } = null!;
    public Event<CrawlCompleted> CrawlCompleted { get; } = null!;
    public Event<EmbedCompleted> EmbedCompleted { get; } = null!;
}
