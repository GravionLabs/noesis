using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using MassTransit;

namespace Gravion.Noesis.UseCases.Crawling.StartCrawlJob;

public class StartCrawlJobHandler(IJobRepository jobs, ISourceRepository sources, IPublishEndpoint publishEndpoint)
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

        await publishEndpoint.Publish(new StartImportSaga(job.Id, cmd.SourceId, source.Url, source.ImporterType), ct);

        return new StartCrawlJobResult(job.Id);
    }
}
