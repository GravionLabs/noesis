using Ardalis.Result;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Search.SearchDocs;

public record SearchDocsQuery(string Query, int Limit = 5, string? SourceName = null) : IQuery<Result<SearchDocsResult>>;

public record SearchDocsResult(List<ChunkResult> Chunks);

public record ChunkResult(Guid Id, string SourceName, string DocUrl, string? Heading, string Content);
