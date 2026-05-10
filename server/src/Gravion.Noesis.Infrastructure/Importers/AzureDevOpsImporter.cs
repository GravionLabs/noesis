using Ardalis.Result;
using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.Core.Models;

namespace Gravion.Noesis.Infrastructure.Importers;

/// <summary>
///     Azure DevOps repository importer — fetches docs from an ADO repo via the ADO REST API.
/// </summary>
public class AzureDevOpsImporter : IImporter
{
    public string ImporterType => "azuredevops";

    public Task<Result<ImportResult>> ImportAsync(Source source, ImportContext context, CancellationToken ct = default) => throw
        // TODO: implement Azure DevOps API integration
        // Config JSON schema: { "organization": "myorg", "project": "myproject", "repo": "myrepo", "branch": "main" }
        new NotImplementedException("Azure DevOps importer not yet implemented.");
}
