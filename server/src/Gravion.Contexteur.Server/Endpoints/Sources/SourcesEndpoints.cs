using Ardalis.Result;

using Carter;

using Gravion.Contexteur.Core.Entities;
using Gravion.Contexteur.UseCases.Import.TriggerImport;
using Gravion.Contexteur.UseCases.Sources.CreateSource;
using Gravion.Contexteur.UseCases.Sources.DeleteSource;
using Gravion.Contexteur.UseCases.Sources.ListSources;

using Wolverine;

namespace Gravion.Contexteur.Server.Endpoints.Sources;

public class SourcesEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/sources").WithTags("Sources");

        group.MapGet("/",
            async (IMessageBus bus) =>
            {
                var result = await bus.InvokeAsync<Result<List<Source>>>(new ListSourcesQuery());
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
            async (CreateSourceRequest req, IMessageBus bus) =>
            {
                var cmd = new CreateSourceCommand(req.Name, req.Url, req.ImporterType, req.Config, req.Schedule);
                var result = await bus.InvokeAsync<Result<Source>>(cmd);
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
            async (Guid id, IMessageBus bus) =>
            {
                await bus.InvokeAsync<Result>(new DeleteSourceCommand(id));
                return Results.NoContent();
            });

        group.MapPost("/{id:guid}/import",
            async (Guid id, IMessageBus bus) =>
            {
                var result = await bus.InvokeAsync<Result<TriggerImportResult>>(new TriggerImportCommand(id));
                if (result.Status == ResultStatus.NotFound)
                    return Results.NotFound();
                return Results.Accepted($"/api/jobs/{result.Value.JobId}",
                    new ImportTriggeredResponse(result.Value.JobId));
            });
    }
}
