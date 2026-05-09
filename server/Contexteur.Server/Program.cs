using Contexteur.Core.Events;
using Contexteur.Infrastructure;
using Contexteur.Infrastructure.Data;
using Contexteur.Server.Tools;
using Contexteur.UseCases.Crawling;
using Contexteur.UseCases.Crawling.StartCrawlJob;
using Contexteur.UseCases.Import.TriggerImport;
using Contexteur.UseCases.Jobs.GetJob;
using Contexteur.UseCases.Jobs.ListJobs;
using Contexteur.UseCases.Sources.CreateSource;
using Contexteur.UseCases.Sources.DeleteSource;
using Contexteur.UseCases.Sources.ListSources;
using Hangfire;
using Hangfire.PostgreSql;
using Wolverine;
using Wolverine.EntityFrameworkCore;
using Wolverine.Postgresql;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Postgres")!;

builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);

// Hangfire with PostgreSQL storage
builder.Services.AddHangfire(config => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(options => options.UseNpgsqlConnection(connectionString)));
builder.Services.AddHangfireServer();

builder.Services
    .AddMcpServer()
    .WithHttpTransport()
    .WithToolsFromAssembly();

builder.Host.UseWolverine(opts =>
{
    opts.PersistMessagesWithPostgresql(connectionString, "contexteur")
        .EnableMessageTransport();
    opts.UseEntityFrameworkCoreTransactions();
    opts.Discovery.IncludeAssembly(typeof(CreateSourceHandler).Assembly);
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.MapMcp("/mcp");

// Hangfire dashboard
app.UseHangfireDashboard("/hangfire");

// Sources API
app.MapGet("/api/sources", async (IMessageBus bus) =>
    await bus.InvokeAsync<List<Contexteur.Core.Entities.Source>>(new ListSourcesQuery()));

app.MapPost("/api/sources", async (CreateSourceCommand cmd, IMessageBus bus) =>
{
    var source = await bus.InvokeAsync<Contexteur.Core.Entities.Source>(cmd);
    return Results.Created($"/api/sources/{source.Id}", source);
});

app.MapDelete("/api/sources/{id:guid}", async (Guid id, IMessageBus bus) =>
{
    await bus.InvokeAsync(new DeleteSourceCommand(id));
    return Results.NoContent();
});

// Manual import trigger
app.MapPost("/api/sources/{id:guid}/import", async (Guid id, IMessageBus bus) =>
{
    var result = await bus.InvokeAsync<TriggerImportResult>(new TriggerImportCommand(id));
    return Results.Accepted($"/api/jobs/{result.JobId}", result);
});

// Jobs API
app.MapGet("/api/jobs", async (IMessageBus bus) =>
    await bus.InvokeAsync<List<Contexteur.Core.Entities.Job>>(new ListJobsQuery()));

app.MapGet("/api/jobs/{id:guid}", async (Guid id, IMessageBus bus) =>
{
    var job = await bus.InvokeAsync<Contexteur.Core.Entities.Job?>(new GetJobQuery(id));
    return job is null ? Results.NotFound() : Results.Ok(job);
});

app.MapPost("/api/jobs/crawl", async (StartCrawlJobCommand cmd, IMessageBus bus) =>
{
    var result = await bus.InvokeAsync<StartCrawlJobResult>(cmd);
    return Results.Accepted($"/api/jobs/{result.JobId}", result);
});

// Internal callbacks from crawler and embedder services
app.MapPost("/api/internal/crawl-completed", async (CrawlCompletedRequest req, IMessageBus bus) =>
{
    await bus.PublishAsync(new CrawlCompleted(req.JobId, req.SourceId, req.DocCount));
    return Results.Ok();
});

app.MapPost("/api/internal/embed-completed", async (EmbedCompletedRequest req, IMessageBus bus) =>
{
    await bus.PublishAsync(new EmbedCompleted(req.JobId, req.SourceId, req.ChunkCount));
    return Results.Ok();
});

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).WithTags("Health");

app.Run();

record CrawlCompletedRequest(Guid JobId, Guid SourceId, int DocCount);
record EmbedCompletedRequest(Guid JobId, Guid SourceId, int ChunkCount);
