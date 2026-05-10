using Gravion.Noesis.Infrastructure.Data;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using Serilog;
using Serilog.Events;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddSerilog((_, loggerConfiguration) =>
{
    loggerConfiguration
        .MinimumLevel.Information()
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
        .Enrich.FromLogContext()
        .Enrich.WithMachineName()
        .Enrich.WithEnvironmentName()
        .Enrich.WithProcessId()
        .Enrich.WithProcessName()
        .WriteTo.Console(
            outputTemplate:
            "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}");

    var seqUrl = builder.Configuration["Seq:ServerUrl"];
    if (!string.IsNullOrEmpty(seqUrl))
        loggerConfiguration.WriteTo.Seq(seqUrl);
});

var connectionString = builder.Configuration.GetConnectionString("noesis")
                       ?? "Host=localhost;Port=5442;Database=noesis;Username=noesis;Password=noesis_dev";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString, o => o.UseVector()));

var host = builder.Build();
using var scope = host.Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

var command = args.FirstOrDefault() ?? "--migrate";

switch (command)
{
    case "--status":
        await PrintStatus(db);
        break;

    case "--dry-run":
        await DryRun(db);
        break;

    case "--rollback":
        var targetMigration = args.ElementAtOrDefault(1);
        await Rollback(db, targetMigration);
        break;

    case "--migrate":
    default:
        await Migrate(db);
        break;
}

static async Task PrintStatus(AppDbContext db)
{
    Console.WriteLine("Migration Status:");
    Console.WriteLine("─────────────────────────────────────────");

    var applied = (await db.Database.GetAppliedMigrationsAsync()).ToHashSet();
    var all = db.Database.GetMigrations().ToList();

    foreach (var migration in all)
    {
        var status = applied.Contains(migration) ? "✅ applied" : "⏳ pending";
        Console.WriteLine($"  {status}  {migration}");
    }

    var pending = all.Except(applied).ToList();
    Console.WriteLine("─────────────────────────────────────────");
    Console.WriteLine($"  {applied.Count} applied, {pending.Count} pending");
}

static async Task DryRun(AppDbContext db)
{
    var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
    if (pending.Count == 0)
    {
        Console.WriteLine("✅ No pending migrations.");
        return;
    }

    Console.WriteLine($"Pending migrations ({pending.Count}):");
    foreach (var m in pending)
        Console.WriteLine($"  ➜ {m}");
    Console.WriteLine("(dry-run: no changes applied)");
}

static async Task Rollback(AppDbContext db, string? targetMigration)
{
    var migrator = db.GetService<IMigrator>();
    var applied = (await db.Database.GetAppliedMigrationsAsync()).ToList();

    if (applied.Count == 0)
    {
        Console.WriteLine("No applied migrations to roll back.");
        return;
    }

    string target;
    if (targetMigration is not null)
    {
        target = targetMigration;
        Console.WriteLine($"Rolling back to: {target}");
    }
    else
    {
        // Roll back the last applied migration
        target = applied.Count > 1 ? applied[^2] : "0";
        var last = applied[^1];
        Console.WriteLine($"Rolling back: {last} → {(target == "0" ? "(empty database)" : target)}");
    }

    await migrator.MigrateAsync(target);
    Console.WriteLine("✅ Rollback complete.");
}

static async Task Migrate(AppDbContext db)
{
    var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
    if (pending.Count == 0)
    {
        Console.WriteLine("✅ Database is up to date. No pending migrations.");
        return;
    }

    Console.WriteLine($"Applying {pending.Count} migration(s):");
    foreach (var m in pending)
        Console.WriteLine($"  ➜ {m}");

    await db.Database.MigrateAsync();
    Console.WriteLine("✅ Migrations applied successfully.");
}
