using Carter;

using Gravion.Noesis.Core.Events;
using Gravion.Noesis.Core.Settings;
using Gravion.Noesis.Infrastructure;
using Gravion.Noesis.Infrastructure.Data;
using Gravion.Noesis.UseCases.Crawling;
using Gravion.Noesis.UseCases.Sources.CreateSource;

using Hangfire;
using Hangfire.PostgreSql;

using MassTransit;

using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

var dbSettings = builder.Configuration.GetSection(DbSettings.SectionName).Get<DbSettings>() ?? new DbSettings();
var rabbitMqSettings = builder.Configuration.GetSection(RabbitMqSettings.SectionName).Get<RabbitMqSettings>() ?? new RabbitMqSettings();
var connectionString = dbSettings.BuildConnectionString();

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

// MassTransit configuration
builder.Services.AddMassTransit(x =>
{
    // Register saga state machine with EF Core persistence
    x.AddSagaStateMachine<ImportJobStateMachine, ImportJobState>()
        .EntityFrameworkRepository(r =>
        {
            r.ExistingDbContext<AppDbContext>();
        });

    x.AddConsumers(typeof(CreateSourceHandler).Assembly);

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(new Uri($"rabbitmq://{rabbitMqSettings.Host}:{rabbitMqSettings.Port}/"));

        cfg.ReceiveEndpoint("noesis.crawl-completed", e =>
        {
            e.ConfigureConsumer<Gravion.Noesis.UseCases.Crawling.CrawlCompletedConsumer>(context);
        });

        cfg.ReceiveEndpoint("noesis.embed-completed", e =>
        {
            e.ConfigureConsumer<Gravion.Noesis.UseCases.Crawling.EmbedCompletedConsumer>(context);
        });

        cfg.ConfigureEndpoints(context);
    });
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
