using Contexteur.Core.Entities;
using Contexteur.Core.Abstractions;
using Contexteur.Core.Models;
using Contexteur.UseCases.Crawling;
using Wolverine;

namespace Contexteur.UseCases.Import.TriggerImport;

public class TriggerImportHandler(ISourceRepository sources, IJobRepository jobs, IMessageBus bus)
{
    public async Task<TriggerImportResult> Handle(TriggerImportCommand cmd, CancellationToken ct)
    {
        var source = await sources.GetByIdAsync(cmd.SourceId, ct)
            ?? throw new InvalidOperationException($"Source {cmd.SourceId} not found");

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
