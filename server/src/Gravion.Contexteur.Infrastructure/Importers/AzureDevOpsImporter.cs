using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;
using Gravion.Contexteur.Core.Models;

namespace Gravion.Contexteur.Infrastructure.Importers;

/// <summary>
///     Azure DevOps repository importer — fetches docs from an ADO repo via the ADO REST API.
/// </summary>
public class AzureDevOpsImporter : IImporter
{
    public string ImporterType => "azuredevops";

    public Task<ImportResult> ImportAsync(Source source, ImportContext context, CancellationToken ct = default) => throw
        // TODO: implement Azure DevOps API integration
        // Config JSON schema: { "organization": "myorg", "project": "myproject", "repo": "myrepo", "branch": "main" }
        new NotImplementedException("Azure DevOps importer not yet implemented.");
}
