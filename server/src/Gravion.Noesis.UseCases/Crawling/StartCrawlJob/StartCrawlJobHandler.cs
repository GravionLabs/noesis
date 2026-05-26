using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using LiteBus.Commands.Abstractions;

using MassTransit;

namespace Gravion.Noesis.UseCases.Crawling.StartCrawlJob;

public class StartCrawlJobHandler(IJobRepository jobs, ISourceRepository sources, IPublishEndpoint publishEndpoint)
    : ICommandHandler<StartCrawlJobCommand, Result<StartCrawlJobResult>>
{
    public async Task<Result<StartCrawlJobResult>> HandleAsync(StartCrawlJobCommand cmd, CancellationToken cancellationToken = default)
    {
        Guard.Against.Default(cmd.SourceId, nameof(cmd.SourceId));

        var source = await sources.GetByIdAsync(cmd.SourceId, cancellationToken);
        if (source is null)
            return Result.NotFound($"Source {cmd.SourceId} not found");

        var job = new Job
        {
            Type = "crawl",
            SourceId = cmd.SourceId,
            Status = "pending"
        };
        await jobs.AddAsync(job, cancellationToken);

        await publishEndpoint.Publish(new StartImportSaga(job.Id, cmd.SourceId, source.Url, source.ImporterType), cancellationToken);

        return new StartCrawlJobResult(job.Id);
    }
}
