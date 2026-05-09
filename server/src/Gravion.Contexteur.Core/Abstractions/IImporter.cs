using Gravion.Contexteur.Core.Entities;
using Gravion.Contexteur.Core.Models;

namespace Gravion.Contexteur.Core.Abstractions;

public interface IImporter
{
    /// <summary>The importer type key this importer handles (e.g. "llmstxt", "github", "crawler").</summary>
    string ImporterType { get; }

    Task<ImportResult> ImportAsync(Source source, ImportContext context, CancellationToken ct = default);
}
