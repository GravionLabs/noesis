using Ardalis.Result;

using Carter;

using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Jobs.GetJob;
using Gravion.Noesis.UseCases.Jobs.ListJobs;

using Wolverine;

namespace Gravion.Noesis.Server.Endpoints.Jobs;

public class JobsEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/jobs").WithTags("Jobs");

        group.MapGet("/",
            async (IMessageBus bus) =>
            {
                var result = await bus.InvokeAsync<Result<List<Job>>>(new ListJobsQuery());
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
            async (Guid id, IMessageBus bus) =>
            {
                var result = await bus.InvokeAsync<Result<Job>>(new GetJobQuery(id));
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
