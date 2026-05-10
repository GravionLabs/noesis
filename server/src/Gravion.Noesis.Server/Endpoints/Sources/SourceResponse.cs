namespace Gravion.Noesis.Server.Endpoints.Sources;

public record SourceResponse(
    Guid Id,
    string Name,
    string Url,
    string ImporterType,
    bool Enabled,
    string? Schedule,
    DateTime? LastImportedAt);
