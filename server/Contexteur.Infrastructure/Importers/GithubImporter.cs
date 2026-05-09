using Contexteur.Core.Entities;
using Contexteur.Core.Abstractions;
using Contexteur.Core.Models;

namespace Contexteur.Infrastructure.Importers;

/// <summary>
/// GitHub repository importer — fetches README and docs from a GitHub repo via the GitHub API.
/// </summary>
public class GithubImporter : IImporter
{
    public string ImporterType => "github";

    public Task<ImportResult> ImportAsync(Source source, ImportContext context, CancellationToken ct = default)
    {
        // TODO: implement GitHub API integration
        // Config JSON schema: { "owner": "angular", "repo": "angular", "branch": "main", "paths": ["docs/"] }
        throw new NotImplementedException(
            "GitHub importer not yet implemented. Use ImporterType='llmstxt' or 'crawler' instead.");
    }
}
