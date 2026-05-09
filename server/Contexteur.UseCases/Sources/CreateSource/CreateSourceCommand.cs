namespace Contexteur.UseCases.Sources.CreateSource;

public record CreateSourceCommand(string Name, string Url, string ImporterType = "llmstxt", string? Config = null, string? Schedule = null);
