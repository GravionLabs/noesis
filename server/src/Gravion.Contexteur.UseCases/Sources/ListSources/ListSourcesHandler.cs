using Ardalis.Result;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;

namespace Gravion.Contexteur.UseCases.Sources.ListSources;

public class ListSourcesHandler(ISourceRepository sources)
{
    public async Task<Result<List<Source>>> Handle(ListSourcesQuery query, CancellationToken ct)
        => await sources.ListAsync(ct);
}
