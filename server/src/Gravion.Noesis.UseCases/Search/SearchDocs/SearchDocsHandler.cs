using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;

namespace Gravion.Noesis.UseCases.Search.SearchDocs;

public class SearchDocsHandler(IChunkRepository chunks, IEmbedQueryClient embedQuery)
{
    public async Task<Result<SearchDocsResult>> Handle(SearchDocsQuery query, CancellationToken ct)
    {
        Guard.Against.NullOrEmpty(query.Query, nameof(query.Query));

        // Try vector similarity search first; fall back to FTS if embedder is unavailable
        var embedResult = await embedQuery.EmbedQueryAsync(query.Query, ct);
        var results = embedResult is not null
            ? await chunks.SearchByVectorAsync(embedResult.Vector, embedResult.Model, query.Limit, query.SourceName, ct)
            : await chunks.SearchByTextAsync(query.Query, query.Limit, query.SourceName, ct);

        return new SearchDocsResult(results.Select(c =>
                new ChunkResult(c.Id, c.Doc.Source.Name, c.Doc.Url, c.Heading, c.Content))
            .ToList());
    }
}
