using Contexteur.Core.Abstractions;
using Contexteur.Infrastructure.Crawling;
using Contexteur.Infrastructure.Data;
using Contexteur.Infrastructure.Data.Repositories;
using Contexteur.Infrastructure.Clients;
using Contexteur.Infrastructure.Importers;
using Contexteur.Infrastructure.Scheduling;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pgvector.EntityFrameworkCore;

namespace Contexteur.Infrastructure;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Postgres")!;

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString, o => o.UseVector()));

        // Repositories
        services.AddScoped<ISourceRepository, SourceRepository>();
        services.AddScoped<IJobRepository, JobRepository>();
        services.AddScoped<IChunkRepository, ChunkRepository>();
        services.AddScoped<IDocRepository, DocRepository>();

        // HTTP clients for external services
        services.AddHttpClient<ICrawlerClient, CrawlerHttpClient>(client =>
            client.BaseAddress = new Uri(configuration["Services:CrawlerUrl"] ?? "http://crawler:3000"));

        services.AddHttpClient<IEmbedderClient, EmbedderHttpClient>(client =>
            client.BaseAddress = new Uri(configuration["Services:EmbedderUrl"] ?? "http://embedder:8000"));

        // Named HttpClient for LlmsTxtImporter
        services.AddHttpClient<LlmsTxtImporter>();

        // Importers — registered individually so they can have their own DI (e.g. typed HttpClient)
        services.AddScoped<IImporter, LlmsTxtImporter>();
        services.AddScoped<IImporter, CrawlerImporter>();
        services.AddScoped<IImporter, GithubImporter>();
        services.AddScoped<IImporter, AzureDevOpsImporter>();
        services.AddScoped<IImporterRegistry, ImporterRegistry>();

        // Hangfire scheduling classes (Hangfire itself is configured in the Server/Program.cs)
        services.AddScoped<ImportScheduler>();
        services.AddHostedService<ScheduleSyncService>();

        return services;
    }
}
