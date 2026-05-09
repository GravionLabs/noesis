using Contexteur.Core.Abstractions;
using Contexteur.UseCases.Import.TriggerImport;
using Hangfire;
using Wolverine;

namespace Contexteur.Infrastructure.Scheduling;

/// <summary>
/// Hangfire job class for running scheduled imports.
/// Hangfire resolves this via DI, so all dependencies are injected.
/// </summary>
public class ImportScheduler(IMessageBus bus, ISourceRepository sources)
{
    public async Task RunImportAsync(Guid sourceId)
    {
        var source = await sources.GetByIdAsync(sourceId);
        if (source is null || !source.Enabled)
            return;

        await bus.InvokeAsync(new TriggerImportCommand(sourceId));
    }
}
