using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;

using Wolverine;

namespace Gravion.Contexteur.UseCases.Crawling.StartCrawlJob;

public class StartCrawlJobHandler(IJobRepository jobs, ISourceRepository sources, IMessageBus bus)
{
    public async Task<Result<StartCrawlJobResult>> Handle(StartCrawlJobCommand cmd, CancellationToken ct)
    {
        Guard.Against.Default(cmd.SourceId, nameof(cmd.SourceId));

        var source = await sources.GetByIdAsync(cmd.SourceId, ct);
        if (source is null)
            return Result.NotFound($"Source {cmd.SourceId} not found");

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
