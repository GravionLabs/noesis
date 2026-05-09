namespace Contexteur.Server.Endpoints.Jobs;

public record JobResponse(
    Guid Id,
    Guid? SourceId,
    string Type,
    string Status,
    string? Error,
    DateTime? StartedAt,
    DateTime? FinishedAt,
    DateTime CreatedAt);