namespace Gravion.Noesis.Core.Settings;

public sealed class OllamaSettings
{
    public const string SectionName = "OllamaSettings";

    public string Url { get; init; } = "http://localhost:11434";
    public string EmbeddingProvider { get; init; } = "ollama";
    public string EmbeddingModel { get; init; } = "nomic-embed-text";
}
