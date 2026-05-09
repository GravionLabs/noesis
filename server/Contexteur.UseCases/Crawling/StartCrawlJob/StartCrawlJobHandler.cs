using Contexteur.Core.Entities;
using Contexteur.Core.Interfaces;
using Contexteur.UseCases.Crawling;
using Wolverine;

namespace Contexteur.UseCases.Crawling.StartCrawlJob;

public class StartCrawlJobHandler(IJobRepository jobs, ISourceRepository sources, IMessageBus bus)
{
    public async Task<StartCrawlJobResult> Handle(StartCrawlJobCommand cmd, CancellationToken ct)
    {
        var source = await sources.GetByIdAsync(cmd.SourceId, ct)
            ?? throw new InvalidOperationException($"Source {cmd.SourceId} not found");

        var job = new Job
        {
            Type = "crawl",
            SourceId = cmd.SourceId,
            Status = "pending"
        };
        await jobs.AddAsync(job, ct);

        await bus.PublishAsync(new StartImportSaga(job.Id, cmd.SourceId, source.Url, source.ImporterType));

        return new StartCrawlJobResult(job.Id);
    }
}
