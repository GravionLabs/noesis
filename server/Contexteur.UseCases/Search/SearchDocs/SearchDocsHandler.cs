using Contexteur.Core.Abstractions;

namespace Contexteur.UseCases.Search.SearchDocs;

public class SearchDocsHandler(IChunkRepository chunks)
{
    public async Task<SearchDocsResult> Handle(SearchDocsQuery query, CancellationToken ct)
    {
        var results = await chunks.SearchByTextAsync(query.Query, query.Limit, query.SourceName, ct);
        return new SearchDocsResult(results.Select(c =>
            new ChunkResult(c.Id, c.Doc.Source.Name, c.Doc.Url, c.Heading, c.Content)).ToList());
    }
}
