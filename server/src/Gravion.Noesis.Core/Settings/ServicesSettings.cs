namespace Gravion.Noesis.Core.Settings;

public sealed class ServicesSettings
{
    public const string SectionName = "Services";

    public string CrawlerUrl { get; init; } = "http://localhost:3001";
    public string EmbedderUrl { get; init; } = "http://embedder:8000";
}
