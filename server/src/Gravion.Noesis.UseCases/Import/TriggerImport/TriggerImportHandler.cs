using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Crawling;

using Wolverine;

namespace Gravion.Noesis.UseCases.Import.TriggerImport;

public class TriggerImportHandler(ISourceRepository sources, IJobRepository jobs, IMessageBus bus)
{
    public async Task<Result<TriggerImportResult>> Handle(TriggerImportCommand cmd, CancellationToken ct)
    {
        Guard.Against.Default(cmd.SourceId, nameof(cmd.SourceId));

        var source = await sources.GetByIdAsync(cmd.SourceId, ct);
        if (source is null)
            return Result.NotFound($"Source {cmd.SourceId} not found");

        var job = new Job
        {
            Type = "import",
            SourceId = cmd.SourceId,
            Status = "pending"
        };

        await jobs.AddAsync(job, ct);
        await bus.PublishAsync(new StartImportSaga(job.Id, cmd.SourceId, source.Url, source.ImporterType));

        return new TriggerImportResult(job.Id);
    }
}
