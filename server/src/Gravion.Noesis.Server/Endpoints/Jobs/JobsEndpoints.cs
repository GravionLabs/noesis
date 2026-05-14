using Ardalis.Result;

using Carter;

using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Jobs.GetJob;
using Gravion.Noesis.UseCases.Jobs.ListJobs;

namespace Gravion.Noesis.Server.Endpoints.Jobs;

public class JobsEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/jobs").WithTags("Jobs");

        group.MapGet("/",
            async (ListJobsHandler handler) =>
            {
                var result = await handler.Handle(new ListJobsQuery(), CancellationToken.None);
                return Results.Ok(result.Value.Select(j => new JobResponse(
                    j.Id,
                    j.SourceId,
                    j.Type,
                    j.Status,
                    j.Error,
                    j.StartedAt,
                    j.FinishedAt,
                    j.CreatedAt)));
            });

        group.MapGet("/{id:guid}",
            async (Guid id, GetJobHandler handler) =>
            {
                var result = await handler.Handle(new GetJobQuery(id), CancellationToken.None);
                if (result.Status == ResultStatus.NotFound)
                    return Results.NotFound();
                return Results.Ok(new JobResponse(
                    result.Value.Id,
                    result.Value.SourceId,
                    result.Value.Type,
                    result.Value.Status,
                    result.Value.Error,
                    result.Value.StartedAt,
                    result.Value.FinishedAt,
                    result.Value.CreatedAt));
            });
    }
}
