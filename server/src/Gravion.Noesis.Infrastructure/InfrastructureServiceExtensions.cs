using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Settings;
using Gravion.Noesis.Infrastructure.Clients;
using Gravion.Noesis.Infrastructure.Data;
using Gravion.Noesis.Infrastructure.Data.Repositories;
using Gravion.Noesis.Infrastructure.Importers;
using Gravion.Noesis.Infrastructure.Scheduling;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Gravion.Noesis.Infrastructure;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<DbSettings>(configuration.GetSection(DbSettings.SectionName));
        services.Configure<RabbitMqSettings>(configuration.GetSection(RabbitMqSettings.SectionName));
        services.Configure<ServicesSettings>(configuration.GetSection(ServicesSettings.SectionName));
        services.Configure<OllamaSettings>(configuration.GetSection(OllamaSettings.SectionName));

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var dbSettings = sp.GetRequiredService<IOptions<DbSettings>>().Value;
            options.UseNpgsql(dbSettings.BuildConnectionString(), o => o.UseVector());
        });

        // Repositories
        services.AddScoped<ISourceRepository, SourceRepository>();
        services.AddScoped<IJobRepository, JobRepository>();
        services.AddScoped<IChunkRepository, ChunkRepository>();
        services.AddScoped<IDocRepository, DocRepository>();

        // Synchronous HTTP client for query-time embedding (user-facing, not event-driven)
        services.AddHttpClient<IEmbedQueryClient, EmbedQueryHttpClient>((sp, client) =>
        {
            var servicesSettings = sp.GetRequiredService<IOptions<ServicesSettings>>().Value;
            client.BaseAddress = new Uri(servicesSettings.EmbedderUrl);
        });

        // HTTP client for triggering batch embedding (event-driven, called by StartEmbedJobConsumer)
        services.AddHttpClient<IEmbedJobClient, EmbedJobHttpClient>((sp, client) =>
        {
            var servicesSettings = sp.GetRequiredService<IOptions<ServicesSettings>>().Value;
            client.BaseAddress = new Uri(servicesSettings.EmbedderUrl);
        });

        // Named HttpClient for importers that fetch remote content directly
        services.AddHttpClient<LlmsTxtImporter>();
        services.AddHttpClient<LlmsMetaTxtImporter>();
        services.AddHttpClient<LlmsTxtCrawlImporter>((sp, client) =>
        {
            var servicesSettings = sp.GetRequiredService<IOptions<ServicesSettings>>().Value;
            client.BaseAddress = new Uri(servicesSettings.CrawlerUrl);
        });
        services.AddHttpClient<NpmReadmeImporter>();
        services.AddHttpClient<OpenApiImporter>();

        // Importers — registered individually so they can have their own DI (e.g. typed HttpClient)
        services.AddScoped<IImporter, LlmsTxtImporter>();
        services.AddScoped<IImporter, LlmsMetaTxtImporter>();
        services.AddScoped<IImporter, LlmsTxtCrawlImporter>();
        services.AddScoped<IImporter, CrawlerImporter>();
        services.AddScoped<IImporter, GithubImporter>();
        services.AddScoped<IImporter, AzureDevOpsImporter>();
        services.AddScoped<IImporter, NpmReadmeImporter>();
        services.AddScoped<IImporter, OpenApiImporter>();
        services.AddScoped<IImporterRegistry, ImporterRegistry>();

        // Hangfire scheduling classes (Hangfire itself is configured in the Server/Program.cs)
        services.AddScoped<ImportScheduler>();
        services.AddHostedService<ScheduleSyncService>();

        return services;
    }
}
