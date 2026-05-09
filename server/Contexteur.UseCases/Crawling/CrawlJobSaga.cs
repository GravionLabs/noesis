using Contexteur.Core.Events;
using Contexteur.Core.Interfaces;
using Wolverine;

namespace Contexteur.UseCases.Crawling;

/// <summary>Message that starts the import saga. The Id property sets Wolverine's saga identity.</summary>
public record StartImportSaga(Guid JobId, Guid SourceId, string SourceUrl, string ImporterType)
{
    public Guid Id => JobId;
}

/// <summary>
/// Orchestrates the full import pipeline: import → embed → done.
/// Strategy-based: the importer is selected via IImporterRegistry based on ImporterType.
/// For in-process importers (llmstxt, github): saga progresses immediately after ImportCompleted.
/// For crawler importer: saga waits for external HTTP callback (CrawlCompleted) before embedding.
/// </summary>
public class ImportJobSaga : Saga
{
    public Guid Id { get; set; }
    public Guid JobId { get; set; }
    public Guid SourceId { get; set; }
    public string ImporterType { get; set; } = "";
    public string Status { get; set; } = "pending";

    public async Task Handle(
        StartImportSaga cmd,
        IImporterRegistry importerRegistry,
        ISourceRepository sources,
        IJobRepository jobs,
        IMessageBus bus,
        CancellationToken ct)
    {
        Id = cmd.JobId;
        JobId = cmd.JobId;
        SourceId = cmd.SourceId;
        ImporterType = cmd.ImporterType;
        Status = "importing";

        var job = await jobs.GetByIdAsync(JobId, ct);
        if (job is not null)
        {
            job.Status = "running";
            job.StartedAt = DateTime.UtcNow;
            await jobs.UpdateAsync(job, ct);
        }

        var source = await sources.GetByIdAsync(SourceId, ct);
        if (source is null)
        {
            await FailAsync(jobs, "Source not found", ct);
            return;
        }

        try
        {
            var importer = importerRegistry.GetImporter(ImporterType);
            var result = await importer.ImportAsync(source, new Core.Interfaces.ImportContext(JobId), ct);

            if (!result.Success)
            {
                await FailAsync(jobs, result.Error ?? "Import failed", ct);
                return;
            }

            if (result.WaitForCallback)
            {
                // External async importer (crawler) — wait for CrawlCompleted callback
                Status = "waiting-crawl-callback";
            }
            else
            {
                // In-process importer completed — proceed to embedding
                await bus.PublishAsync(new ImportCompleted(JobId, SourceId, result.DocCount, result.ChunkCount));
            }
        }
        catch (Exception ex)
        {
            await FailAsync(jobs, ex.Message, ct);
        }
    }

    // For in-process importers: triggered immediately after import
    public async Task Handle(
        ImportCompleted evt,
        IEmbedderClient embedder,
        IJobRepository jobs,
        CancellationToken ct)
    {
        Status = "embedding";

        var result = await embedder.StartEmbedAsync(JobId, SourceId, ct);
        if (!result.Success)
        {
            await FailAsync(jobs, result.Error ?? "Embed failed", ct);
        }
        // On success: embedder calls back POST /api/internal/embed-completed → publishes EmbedCompleted
    }

    // For crawler importer: external HTTP callback from Node.js crawler
    public async Task Handle(
        CrawlCompleted evt,
        IEmbedderClient embedder,
        IJobRepository jobs,
        CancellationToken ct)
    {
        Status = "embedding";

        var result = await embedder.StartEmbedAsync(JobId, SourceId, ct);
        if (!result.Success)
        {
            await FailAsync(jobs, result.Error ?? "Embed failed", ct);
        }
        // On success: embedder calls back POST /api/internal/embed-completed → publishes EmbedCompleted
    }

    // Final step: embedder completed
    public async Task Handle(
        EmbedCompleted evt,
        ISourceRepository sources,
        IJobRepository jobs,
        CancellationToken ct)
    {
        Status = "done";

        var source = await sources.GetByIdAsync(SourceId, ct);
        if (source is not null)
        {
            source.LastImportedAt = DateTime.UtcNow;
            await sources.UpdateAsync(source, ct);
        }

        var job = await jobs.GetByIdAsync(JobId, ct);
        if (job is not null)
        {
            job.Status = "done";
            job.FinishedAt = DateTime.UtcNow;
            await jobs.UpdateAsync(job, ct);
        }

        MarkCompleted();
    }

    private async Task FailAsync(IJobRepository jobs, string error, CancellationToken ct)
    {
        Status = "failed";
        var job = await jobs.GetByIdAsync(JobId, ct);
        if (job is not null)
        {
            job.Status = "failed";
            job.Error = error;
            job.FinishedAt = DateTime.UtcNow;
            await jobs.UpdateAsync(job, ct);
        }
        MarkCompleted();
    }
}
