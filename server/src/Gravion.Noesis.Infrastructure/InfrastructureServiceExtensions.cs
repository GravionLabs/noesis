using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Infrastructure.Clients;
using Gravion.Noesis.Infrastructure.Crawling;
using Gravion.Noesis.Infrastructure.Data;
using Gravion.Noesis.Infrastructure.Data.Repositories;
using Gravion.Noesis.Infrastructure.Importers;
using Gravion.Noesis.Infrastructure.Scheduling;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Gravion.Noesis.Infrastructure;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("noesis")!;

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
