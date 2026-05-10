using Carter;

using Gravion.Noesis.Core.Events;

using Wolverine;

namespace Gravion.Noesis.Server.Endpoints.Internal;

public class InternalEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/internal").WithTags("Internal");

        group.MapPost("/crawl-completed",
            async (CrawlCompletedRequest req, IMessageBus bus) =>
            {
                await bus.PublishAsync(new CrawlCompleted(req.JobId, req.SourceId, req.DocCount));
                return Results.Ok();
            });

        group.MapPost("/embed-completed",
            async (EmbedCompletedRequest req, IMessageBus bus) =>
            {
                await bus.PublishAsync(new EmbedCompleted(req.JobId, req.SourceId, req.ChunkCount));
                return Results.Ok();
            });
    }
}
