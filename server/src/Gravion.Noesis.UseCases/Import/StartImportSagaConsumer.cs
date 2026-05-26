using Ardalis.GuardClauses;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Events;
using Gravion.Noesis.Core.Models;
using Gravion.Noesis.UseCases.Crawling;

using MassTransit;

namespace Gravion.Noesis.UseCases.Import;

public class StartImportSagaConsumer(
    IImporterRegistry importerRegistry,
    ISourceRepository sources,
    IJobRepository jobs,
    IPublishEndpoint publishEndpoint)
    : IConsumer<StartImportSaga>
{
    public async Task Consume(ConsumeContext<StartImportSaga> context)
    {
        Guard.Against.Null(context);

        var cmd = context.Message;

        var job = await jobs.GetByIdAsync(cmd.JobId, context.CancellationToken);
        if (job is not null)
        {
            job.Status = "running";
            job.StartedAt = DateTime.UtcNow;
            await jobs.UpdateAsync(job, context.CancellationToken);
        }

        var source = await sources.GetByIdAsync(cmd.SourceId, context.CancellationToken);
        if (source is null)
        {
            await FailJobAsync(cmd.JobId, "Source not found", context.CancellationToken);
            return;
        }

        try
        {
            var importer = importerRegistry.GetImporter(cmd.ImporterType);
            var result = await importer.ImportAsync(source, new ImportContext(cmd.JobId), context.CancellationToken);

            if (!result.IsSuccess)
            {
                await FailJobAsync(cmd.JobId, string.Join(", ", result.Errors), context.CancellationToken);
                return;
            }

            var importData = result.Value;
            if (importData.WaitForCallback)
            {
                // External async importer (crawler) — wait for CrawlCompleted from RabbitMQ
                // The consumers will handle the next transition
            }
            else
            {
                // In-process importer completed — trigger embedding
                await publishEndpoint.Publish(
                    new ImportCompleted(cmd.JobId, cmd.SourceId, importData.DocCount, importData.ChunkCount),
                    context.CancellationToken);
            }
        }
        catch (Exception ex)
        {
            await FailJobAsync(cmd.JobId, ex.Message, context.CancellationToken);
        }
    }

    private async Task FailJobAsync(Guid jobId, string error, CancellationToken ct)
    {
        var job = await jobs.GetByIdAsync(jobId, ct);
        if (job is not null)
        {
            job.Status = "failed";
            job.FinishedAt = DateTime.UtcNow;
            await jobs.UpdateAsync(job, ct);
        }
    }
}
