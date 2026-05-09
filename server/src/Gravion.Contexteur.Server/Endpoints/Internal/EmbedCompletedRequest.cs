namespace Gravion.Contexteur.Server.Endpoints.Internal;

public record EmbedCompletedRequest(Guid JobId, Guid SourceId, int ChunkCount);
