namespace Contexteur.Core.Events;

/// <summary>
/// Published by in-process importers (LlmsTxtImporter, GithubImporter, etc.) when import is complete.
/// For the crawler importer, CrawlCompleted is used instead (external async callback).
/// </summary>
public record ImportCompleted(Guid JobId, Guid SourceId, int DocCount, int ChunkCount)
{
    public Guid SagaId => JobId;
}
