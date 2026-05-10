using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

namespace Gravion.Noesis.UseCases.Sources.ListSources;

public class ListSourcesHandler(ISourceRepository sources)
{
    public async Task<Result<List<Source>>> Handle(ListSourcesQuery query, CancellationToken ct)
        => await sources.ListAsync(ct);
}
