using Carter;

using Gravion.Contexteur.Infrastructure;
using Gravion.Contexteur.UseCases.Sources.CreateSource;

using Hangfire;
using Hangfire.PostgreSql;

using Scalar.AspNetCore;

using Wolverine;
using Wolverine.EntityFrameworkCore;
using Wolverine.Postgresql;
using Wolverine.RabbitMQ;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

var connectionString = builder.Configuration.GetConnectionString("contexteur")!;

builder.Services.AddOpenApi();
builder.Services.AddCarter();
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

    opts.UseRabbitMq(rabbit =>
        {
            rabbit.HostName = builder.Configuration["RabbitMq:Host"] ?? "localhost";
            if (int.TryParse(builder.Configuration["RabbitMq:Port"], out var port))
                rabbit.Port = port;
        })
        .AutoProvision();

    opts.UseEntityFrameworkCoreTransactions();
    opts.Discovery.IncludeAssembly(typeof(CreateSourceHandler).Assembly);
});

var app = builder.Build();

app.MapDefaultEndpoints();

app.MapOpenApi();
app.MapScalarApiReference(options => options.WithTitle("Gravion.Contexteur API"));

app.MapMcp("/mcp");

app.UseHangfireDashboard();

app.MapCarter();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).WithTags("Health");

app.Run();
