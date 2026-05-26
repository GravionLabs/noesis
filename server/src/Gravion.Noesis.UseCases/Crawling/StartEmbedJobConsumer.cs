using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Events;

using MassTransit;

using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.UseCases.Crawling;

public class StartEmbedJobConsumer(
    IEmbedJobClient embedClient,
    IJobRepository jobs,
    ILogger<StartEmbedJobConsumer> logger)
    : IConsumer<StartEmbedJob>
{
    public async Task Consume(ConsumeContext<StartEmbedJob> context)
    {
        var evt = context.Message;
        logger.LogInformation("StartEmbedJob received — job={JobId} source={SourceId}", evt.JobId, evt.SourceId);

        var job = await jobs.GetByIdAsync(evt.JobId, context.CancellationToken);
        if (job is not null)
        {
            job.Status = "embedding";
            await jobs.UpdateAsync(job, context.CancellationToken);
        }

        // Fire-and-forget: Python embedder will call back via POST /api/internal/embed-completed
        await embedClient.TriggerAsync(evt.JobId, evt.SourceId, context.CancellationToken);
    }
}
