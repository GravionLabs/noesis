namespace Gravion.Noesis.UseCases.Search.SearchDocs;

public record SearchDocsQuery(string Query, int Limit = 5, string? SourceName = null);

public record SearchDocsResult(List<ChunkResult> Chunks);

public record ChunkResult(Guid Id, string SourceName, string DocUrl, string? Heading, string Content);
