namespace Gravion.Noesis.Core.Models;

/// <param name="WaitForCallback">
///     True when the importer triggers an external async process (e.g. Node.js crawler).
///     False when the import is fully in-process (e.g. llmstxt, github).
/// </param>
public record ImportResult(
    bool Success,
    int DocCount,
    int ChunkCount,
    string? Error = null,
    bool WaitForCallback = false);
