using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Sources.ListSources;

public class ListSourcesHandler(ISourceRepository sources) : IQueryHandler<ListSourcesQuery, Result<List<Source>>>
{
    public async Task<Result<List<Source>>> HandleAsync(ListSourcesQuery query, CancellationToken cancellationToken = default)
        => await sources.ListAsync(cancellationToken);
}
