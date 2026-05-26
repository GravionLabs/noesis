using Carter;

using Gravion.Noesis.Core.Events;

using MassTransit;

namespace Gravion.Noesis.Server.Endpoints.Internal;

/// <summary>Internal callbacks from background workers (embedder, crawler).</summary>
public class InternalEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/internal").WithTags("Internal");

        group.MapPost("/embed-completed",
            async (EmbedCompletedRequest req, IPublishEndpoint publish, CancellationToken ct) =>
            {
                await publish.Publish(
                    new EmbedCompleted(req.JobId, req.SourceId, req.ChunkCount),
                    ct);
                return Results.Ok();
            });
    }
}

public record EmbedCompletedRequest(Guid JobId, Guid SourceId, int ChunkCount);
