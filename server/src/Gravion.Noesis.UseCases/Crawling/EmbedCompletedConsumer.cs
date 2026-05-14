using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Events;

using MassTransit;

namespace Gravion.Noesis.UseCases.Crawling;

public class EmbedCompletedConsumer : IConsumer<EmbedCompleted>
{
    private readonly ISourceRepository _sources;
    private readonly IJobRepository _jobs;

    public EmbedCompletedConsumer(ISourceRepository sources, IJobRepository jobs)
    {
        _sources = sources;
        _jobs = jobs;
    }

    public async Task Consume(ConsumeContext<EmbedCompleted> context)
    {
        var evt = context.Message;
        
        var source = await _sources.GetByIdAsync(evt.SourceId, context.CancellationToken);
        if (source != null)
        {
            source.LastImportedAt = DateTime.UtcNow;
            await _sources.UpdateAsync(source, context.CancellationToken);
        }

        var job = await _jobs.GetByIdAsync(evt.JobId, context.CancellationToken);
        if (job != null)
        {
            job.Status = "done";
            job.FinishedAt = DateTime.UtcNow;
            await _jobs.UpdateAsync(job, context.CancellationToken);
        }
    }
}
