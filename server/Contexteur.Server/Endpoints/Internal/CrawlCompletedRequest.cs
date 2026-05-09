namespace Contexteur.Server.Endpoints.Internal;

public record CrawlCompletedRequest(Guid JobId, Guid SourceId, int DocCount);