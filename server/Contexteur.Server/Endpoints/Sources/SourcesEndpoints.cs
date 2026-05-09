using Carter;
using Contexteur.Core.Entities;
using Contexteur.UseCases.Import.TriggerImport;
using Contexteur.UseCases.Sources.CreateSource;
using Contexteur.UseCases.Sources.DeleteSource;
using Contexteur.UseCases.Sources.ListSources;
using Wolverine;

namespace Contexteur.Server.Endpoints.Sources;

public class SourcesEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/sources").WithTags("Sources");

        group.MapGet("/", async (IMessageBus bus) =>
        {
            var sources = await bus.InvokeAsync<List<Source>>(new ListSourcesQuery());
            return Results.Ok(sources.Select(s => new SourceResponse(
                s.Id, s.Name, s.Url, s.ImporterType, s.Enabled, s.Schedule, s.LastImportedAt)));
        });

        group.MapPost("/", async (CreateSourceRequest req, IMessageBus bus) =>
        {
            var cmd = new CreateSourceCommand(req.Name, req.Url, req.ImporterType, req.Config, req.Schedule);
            var source = await bus.InvokeAsync<Source>(cmd);
            var response = new SourceResponse(
                source.Id, source.Name, source.Url, source.ImporterType, source.Enabled, source.Schedule,
                source.LastImportedAt);
            return Results.Created($"/api/sources/{source.Id}", response);
        });

        group.MapDelete("/{id:guid}", async (Guid id, IMessageBus bus) =>
        {
            await bus.InvokeAsync(new DeleteSourceCommand(id));
            return Results.NoContent();
        });

        group.MapPost("/{id:guid}/import", async (Guid id, IMessageBus bus) =>
        {
            var result = await bus.InvokeAsync<TriggerImportResult>(new TriggerImportCommand(id));
            return Results.Accepted($"/api/jobs/{result.JobId}", new ImportTriggeredResponse(result.JobId));
        });
    }
}