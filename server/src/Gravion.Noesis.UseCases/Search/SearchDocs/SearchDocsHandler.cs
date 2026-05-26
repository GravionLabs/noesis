using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Search.SearchDocs;

public class SearchDocsHandler(IChunkRepository chunks, IEmbedQueryClient embedQuery)
    : IQueryHandler<SearchDocsQuery, Result<SearchDocsResult>>
{
    public async Task<Result<SearchDocsResult>> HandleAsync(SearchDocsQuery query, CancellationToken cancellationToken = default)
    {
        Guard.Against.Null(query);
        Guard.Against.NullOrEmpty(query.Query, nameof(query.Query));

        var embedResult = await embedQuery.EmbedQueryAsync(query.Query, cancellationToken);
        var results = embedResult is not null
            ? await chunks.SearchByVectorAsync(embedResult.Vector, embedResult.Model, query.Limit, query.SourceName, cancellationToken)
            : await chunks.SearchByTextAsync(query.Query, query.Limit, query.SourceName, cancellationToken);

        return new SearchDocsResult(results.Select(c =>
                new ChunkResult(c.Id, c.Doc.Source.Name, c.Doc.Url, c.Heading, c.Content))
            .ToList());
    }
}
