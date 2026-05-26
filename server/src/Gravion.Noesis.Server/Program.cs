using Carter;

using Gravion.Noesis.Core.Settings;
using Gravion.Noesis.Infrastructure;
using Gravion.Noesis.Infrastructure.Data;
using Gravion.Noesis.UseCases.Crawling;
using Gravion.Noesis.UseCases.Sources.CreateSource;

using Hangfire;
using Hangfire.PostgreSql;

using LiteBus.Commands;
using LiteBus.Extensions.Microsoft.DependencyInjection;
using LiteBus.Queries;

using MassTransit;
using MassTransit.EntityFrameworkCoreIntegration;

using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

var dbSettings = builder.Configuration.GetSection(DbSettings.SectionName).Get<DbSettings>() ?? new DbSettings();
var rabbitMqSettings = builder.Configuration.GetSection(RabbitMqSettings.SectionName).Get<RabbitMqSettings>() ?? new RabbitMqSettings();
var mcpSettings = builder.Configuration.GetSection(McpSettings.SectionName).Get<McpSettings>() ?? new McpSettings();
var mcpAllowedOrigins = mcpSettings.InspectorAllowedOrigins
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();
var mcpAllowedOriginsSet = new HashSet<string>(mcpAllowedOrigins, StringComparer.OrdinalIgnoreCase);
var connectionString = dbSettings.BuildConnectionString();

builder.Services.AddOpenApi();
builder.Services.AddCarter();
builder.Services.AddInfrastructure(builder.Configuration);

var useCasesAssembly = typeof(CreateSourceHandler).Assembly;
builder.Services.AddLiteBus(liteBus =>
{
    liteBus.AddCommandModule(module => module.RegisterFromAssembly(useCasesAssembly));
    liteBus.AddQueryModule(module => module.RegisterFromAssembly(useCasesAssembly));
});

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
    .WithHttpTransport(options => options.Stateless = true)
    .WithToolsFromAssembly();

// MassTransit configuration
builder.Services.AddMassTransit(x =>
{
    // Register saga state machine with EF Core persistence
    x.AddSagaStateMachine<ImportJobStateMachine, ImportJobState>()
        .EntityFrameworkRepository(r =>
        {
            r.ExistingDbContext<AppDbContext>();
            r.LockStatementProvider = new PostgresLockStatementProvider();
        });

    x.AddConsumers(typeof(CreateSourceHandler).Assembly);

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(new Uri($"rabbitmq://{rabbitMqSettings.Host}:{rabbitMqSettings.Port}/"));

        cfg.ConfigureEndpoints(context);
    });
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    if (context.Request.Path.Equals("/mcp", StringComparison.OrdinalIgnoreCase))
    {
        var origin = context.Request.Headers.Origin.ToString();
        var isAllowedOrigin = !string.IsNullOrWhiteSpace(origin) && mcpAllowedOriginsSet.Contains(origin);
        if (isAllowedOrigin)
        {
            context.Response.Headers["Access-Control-Allow-Origin"] = origin;
            context.Response.Headers.Append("Vary", "Origin");
            context.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS";
            context.Response.Headers["Access-Control-Allow-Headers"] =
                context.Request.Headers["Access-Control-Request-Headers"].ToString();
        }

        if (HttpMethods.IsOptions(context.Request.Method))
        {
            context.Response.StatusCode = isAllowedOrigin
                ? StatusCodes.Status204NoContent
                : StatusCodes.Status403Forbidden;
            return;
        }
    }

    await next();
});

app.MapDefaultEndpoints();

app.MapOpenApi();
app.MapScalarApiReference(options => options.WithTitle("Gravion.Noesis API"));

app.MapMcp("/mcp");

app.UseHangfireDashboard();

app.MapCarter();

app.MapGet("/health", () => Results.Ok(new { Status = "ok" })).WithTags("Health");

app.Run();
