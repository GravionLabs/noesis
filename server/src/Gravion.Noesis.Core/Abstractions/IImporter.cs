using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.Core.Models;

namespace Gravion.Noesis.Core.Abstractions;

public interface IImporter
{
    /// <summary>The importer type key this importer handles (e.g. "llmstxt", "github", "crawler").</summary>
    string ImporterType { get; }

    Task<ImportResult> ImportAsync(Source source, ImportContext context, CancellationToken ct = default);
}
