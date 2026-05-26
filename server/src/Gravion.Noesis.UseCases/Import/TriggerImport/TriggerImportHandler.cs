using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Crawling;

using LiteBus.Commands.Abstractions;

using MassTransit;

namespace Gravion.Noesis.UseCases.Import.TriggerImport;

public class TriggerImportHandler(ISourceRepository sources, IJobRepository jobs, IPublishEndpoint publishEndpoint)
    : ICommandHandler<TriggerImportCommand, Result<TriggerImportResult>>
{
    public async Task<Result<TriggerImportResult>> HandleAsync(TriggerImportCommand cmd, CancellationToken cancellationToken = default)
    {
        Guard.Against.Default(cmd.SourceId, nameof(cmd.SourceId));

        var source = await sources.GetByIdAsync(cmd.SourceId, cancellationToken);
        if (source is null)
            return Result.NotFound($"Source {cmd.SourceId} not found");

        var job = new Job
        {
            Type = "import",
            SourceId = cmd.SourceId,
            Status = "pending"
        };

        await jobs.AddAsync(job, cancellationToken);
        await publishEndpoint.Publish(new StartImportSaga(job.Id, cmd.SourceId, source.Url, source.ImporterType), cancellationToken);

        return new TriggerImportResult(job.Id);
    }
}
