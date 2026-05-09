using Contexteur.Core.Entities;

namespace Contexteur.Core.Interfaces;

public interface IImporter
{
    /// <summary>The importer type key this importer handles (e.g. "llmstxt", "github", "crawler").</summary>
    string ImporterType { get; }

    Task<ImportResult> ImportAsync(Source source, ImportContext context, CancellationToken ct = default);
}

/// <param name="JobId">Saga/Job ID for correlation and callbacks.</param>
public record ImportContext(Guid JobId);

/// <param name="WaitForCallback">
///   True when the importer triggers an external async process (e.g. Node.js crawler).
///   False when the import is fully in-process (e.g. llmstxt, github).
/// </param>
public record ImportResult(
    bool Success,
    int DocCount,
    int ChunkCount,
    string? Error = null,
    bool WaitForCallback = false);
