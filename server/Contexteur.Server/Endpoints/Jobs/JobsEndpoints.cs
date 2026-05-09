using Carter;
using Contexteur.UseCases.Jobs.GetJob;
using Contexteur.UseCases.Jobs.ListJobs;
using Wolverine;

namespace Contexteur.Server.Endpoints.Jobs;

public class JobsEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/jobs").WithTags("Jobs");

        group.MapGet("/", async (IMessageBus bus) =>
        {
            var jobs = await bus.InvokeAsync<List<Core.Entities.Job>>(new ListJobsQuery());
            return Results.Ok(jobs.Select(j => new JobResponse(
                j.Id, j.SourceId, j.Type, j.Status, j.Error, j.StartedAt, j.FinishedAt, j.CreatedAt)));
        });

        group.MapGet("/{id:guid}", async (Guid id, IMessageBus bus) =>
        {
            var job = await bus.InvokeAsync<Core.Entities.Job?>(new GetJobQuery(id));
            if (job is null) return Results.NotFound();
            return Results.Ok(new JobResponse(
                job.Id, job.SourceId, job.Type, job.Status, job.Error, job.StartedAt, job.FinishedAt, job.CreatedAt));
        });
    }
}

public record JobResponse(
    Guid Id,
    Guid? SourceId,
    string Type,
    string Status,
    string? Error,
    DateTime? StartedAt,
    DateTime? FinishedAt,
    DateTime CreatedAt);
