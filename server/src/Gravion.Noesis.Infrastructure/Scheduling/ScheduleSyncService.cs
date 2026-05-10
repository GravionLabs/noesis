using Gravion.Noesis.Core.Abstractions;

using Hangfire;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Gravion.Noesis.Infrastructure.Scheduling;

/// <summary>
///     Background service that registers recurring Hangfire jobs on startup
///     for all enabled sources with a configured schedule (cron expression).
/// </summary>
public class ScheduleSyncService(
    IServiceScopeFactory scopeFactory,
    ILogger<ScheduleSyncService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var sources = scope.ServiceProvider.GetRequiredService<ISourceRepository>();

        var all = await sources.ListAsync(ct);
        var scheduled = 0;

        foreach (var source in all.Where(s => s.Enabled && !string.IsNullOrEmpty(s.Schedule)))
        {
            RecurringJob.AddOrUpdate<ImportScheduler>(
                $"import-{source.Id}",
                s => s.RunImportAsync(source.Id),
                source.Schedule!);

            scheduled++;
            logger.LogInformation("Registered recurring import job for source {Name} ({Id}) with schedule '{Schedule}'",
                source.Name,
                source.Id,
                source.Schedule);
        }

        logger.LogInformation("ScheduleSyncService: {Count} recurring import job(s) registered", scheduled);
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
