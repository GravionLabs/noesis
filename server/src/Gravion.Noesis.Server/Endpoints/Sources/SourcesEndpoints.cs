using Ardalis.Result;

using Carter;

using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Import.TriggerImport;
using Gravion.Noesis.UseCases.Sources.CreateSource;
using Gravion.Noesis.UseCases.Sources.DeleteSource;
using Gravion.Noesis.UseCases.Sources.ListSources;

namespace Gravion.Noesis.Server.Endpoints.Sources;

public class SourcesEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/sources").WithTags("Sources");

        group.MapGet("/",
            async (ListSourcesHandler handler) =>
            {
                var result = await handler.Handle(new ListSourcesQuery(), CancellationToken.None);
                return Results.Ok(result.Value.Select(s => new SourceResponse(
                    s.Id,
                    s.Name,
                    s.Url,
                    s.ImporterType,
                    s.Enabled,
                    s.Schedule,
                    s.LastImportedAt)));
            });

        group.MapPost("/",
            async (CreateSourceRequest req, CreateSourceHandler handler) =>
            {
                var cmd = new CreateSourceCommand(req.Name, req.Url, req.ImporterType, req.Config, req.Schedule);
                var result = await handler.Handle(cmd, CancellationToken.None);
                if (!result.IsSuccess)
                    return Results.BadRequest(result.Errors);
                var source = result.Value;
                return Results.Created($"/api/sources/{source.Id}",
                    new SourceResponse(
                        source.Id,
                        source.Name,
                        source.Url,
                        source.ImporterType,
                        source.Enabled,
                        source.Schedule,
                        source.LastImportedAt));
            });

        group.MapDelete("/{id:guid}",
            async (Guid id, DeleteSourceHandler handler) =>
            {
                await handler.Handle(new DeleteSourceCommand(id), CancellationToken.None);
                return Results.NoContent();
            });

        group.MapPost("/{id:guid}/import",
            async (Guid id, TriggerImportHandler handler) =>
            {
                var result = await handler.Handle(new TriggerImportCommand(id), CancellationToken.None);
                if (result.Status == ResultStatus.NotFound)
                    return Results.NotFound();
                return Results.Accepted($"/api/jobs/{result.Value.JobId}",
                    new ImportTriggeredResponse(result.Value.JobId));
            });
    }
}
