using Carter;

using Gravion.Noesis.Core.Events;
using Gravion.Noesis.Infrastructure;
using Gravion.Noesis.UseCases.Sources.CreateSource;

using Hangfire;
using Hangfire.PostgreSql;

using Scalar.AspNetCore;

using Wolverine;
using Wolverine.EntityFrameworkCore;
using Wolverine.Postgresql;
using Wolverine.RabbitMQ;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

var connectionString = builder.Configuration.GetConnectionString("noesis")!;

builder.Services.AddOpenApi();
builder.Services.AddCarter();
builder.Services.AddInfrastructure(builder.Configuration);

// Hangfire with PostgreSQL storage
builder.Services.AddHangfire(config => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(
        options => options.UseNpgsqlConnection(connectionString),
        new PostgreSqlStorageOptions { SchemaName = "public" }));
builder.Services.AddHangfireServer();

builder.Services
    .AddMcpServer()
    .WithHttpTransport()
    .WithToolsFromAssembly();

builder.Host.UseWolverine(opts =>
{
    opts.PersistMessagesWithPostgresql(connectionString, "public")
        .EnableMessageTransport();

    opts.UseRabbitMq(rabbit =>
        {
            rabbit.HostName = builder.Configuration["RabbitMq:Host"] ?? "localhost";
            if (int.TryParse(builder.Configuration["RabbitMq:Port"], out var port))
                rabbit.Port = port;
        })
        .AutoProvision();

    // Outbound: server → crawler / embedder
    opts.PublishMessage<StartCrawlJob>().ToRabbitQueue("noesis.start-crawl-job");
    opts.PublishMessage<StartEmbedJob>().ToRabbitQueue("noesis.start-embed-job");

    // Inbound: crawler / embedder → server (saga handlers)
    // DefaultIncomingMessage tells Wolverine which .NET type to deserialize from each queue,
    // so Python/Node don't need to set a message-type header.
    opts.ListenToRabbitQueue("noesis.crawl-completed").DefaultIncomingMessage<CrawlCompleted>();
    opts.ListenToRabbitQueue("noesis.embed-completed").DefaultIncomingMessage<EmbedCompleted>();

    opts.UseEntityFrameworkCoreTransactions();
    opts.Discovery.IncludeAssembly(typeof(CreateSourceHandler).Assembly);
});

var app = builder.Build();

app.MapDefaultEndpoints();

app.MapOpenApi();
app.MapScalarApiReference(options => options.WithTitle("Gravion.Noesis API"));

app.MapMcp("/mcp");

app.UseHangfireDashboard();

app.MapCarter();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).WithTags("Health");

app.Run();
