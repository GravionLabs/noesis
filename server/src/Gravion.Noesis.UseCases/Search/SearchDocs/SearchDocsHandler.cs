using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;

namespace Gravion.Noesis.UseCases.Search.SearchDocs;

public class SearchDocsHandler(IChunkRepository chunks)
{
    public async Task<Result<SearchDocsResult>> Handle(SearchDocsQuery query, CancellationToken ct)
    {
        Guard.Against.NullOrEmpty(query.Query, nameof(query.Query));

        var results = await chunks.SearchByTextAsync(query.Query, query.Limit, query.SourceName, ct);
        return new SearchDocsResult(results.Select(c =>
                new ChunkResult(c.Id, c.Doc.Source.Name, c.Doc.Url, c.Heading, c.Content))
            .ToList());
    }
}
