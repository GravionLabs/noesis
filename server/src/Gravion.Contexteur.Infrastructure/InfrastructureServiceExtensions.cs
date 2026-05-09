using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Infrastructure.Clients;
using Gravion.Contexteur.Infrastructure.Crawling;
using Gravion.Contexteur.Infrastructure.Data;
using Gravion.Contexteur.Infrastructure.Data.Repositories;
using Gravion.Contexteur.Infrastructure.Importers;
using Gravion.Contexteur.Infrastructure.Scheduling;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Gravion.Contexteur.Infrastructure;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("contexteur")!;

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

        // Named HttpClient for importers that fetch remote content directly
        services.AddHttpClient<LlmsTxtImporter>();
        services.AddHttpClient<LlmsMetaTxtImporter>();
        services.AddHttpClient<LlmsTxtCrawlImporter>(client =>
            client.BaseAddress = new Uri(configuration["Services:CrawlerUrl"] ?? "http://crawler:3000"));

        // Importers — registered individually so they can have their own DI (e.g. typed HttpClient)
        services.AddScoped<IImporter, LlmsTxtImporter>();
        services.AddScoped<IImporter, LlmsMetaTxtImporter>();
        services.AddScoped<IImporter, LlmsTxtCrawlImporter>();
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
