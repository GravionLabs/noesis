namespace Gravion.Contexteur.UseCases.Crawling.StartCrawlJob;

public record StartCrawlJobCommand(Guid SourceId);

public record StartCrawlJobResult(Guid JobId);
