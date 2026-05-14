using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Events;

using MassTransit;

namespace Gravion.Noesis.UseCases.Crawling;

public class CrawlCompletedConsumer : IConsumer<CrawlCompleted>
{
    private readonly IJobRepository _jobs;

    public CrawlCompletedConsumer(IJobRepository jobs)
    {
        _jobs = jobs;
    }

    public async Task Consume(ConsumeContext<CrawlCompleted> context)
    {
        var evt = context.Message;
        var job = await _jobs.GetByIdAsync(evt.JobId, context.CancellationToken);
        if (job != null)
        {
            job.Status = "embedding";
            await _jobs.UpdateAsync(job, context.CancellationToken);
        }
    }
}
