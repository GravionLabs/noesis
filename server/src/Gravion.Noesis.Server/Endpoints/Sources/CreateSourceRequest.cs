namespace Gravion.Noesis.Server.Endpoints.Sources;

public record CreateSourceRequest(
    string Name,
    string Url,
    string ImporterType = "llmstxt",
    string? Config = null,
    string? Schedule = null);
