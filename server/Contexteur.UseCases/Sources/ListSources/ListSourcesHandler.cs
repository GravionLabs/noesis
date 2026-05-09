using Contexteur.Core.Entities;
using Contexteur.Core.Abstractions;

namespace Contexteur.UseCases.Sources.ListSources;

public class ListSourcesHandler(ISourceRepository sources)
{
    public Task<List<Source>> Handle(ListSourcesQuery query, CancellationToken ct)
        => sources.ListAsync(ct);
}
