using Ardalis.Result;

using Carter;

using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Import.TriggerImport;
using Gravion.Noesis.UseCases.Sources.CreateSource;
using Gravion.Noesis.UseCases.Sources.DeleteSource;
using Gravion.Noesis.UseCases.Sources.ListSources;

using LiteBus.Commands.Abstractions;
using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.Server.Endpoints.Sources;

public class SourcesEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/sources").WithTags("Sources");

        group.MapGet("/",
            async (IQueryMediator qry) =>
            {
                var result = await qry.QueryAsync(new ListSourcesQuery());
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
            async (CreateSourceRequest req, ICommandMediator cmd) =>
            {
                var command = new CreateSourceCommand(req.Name, req.Url, req.ImporterType, req.Config, req.Schedule);
                var result = await cmd.SendAsync(command);
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
            async (Guid id, ICommandMediator cmd) =>
            {
                await cmd.SendAsync(new DeleteSourceCommand(id));
                return Results.NoContent();
            });

        group.MapPost("/{id:guid}/import",
            async (Guid id, ICommandMediator cmd) =>
            {
                var result = await cmd.SendAsync(new TriggerImportCommand(id));
                if (result.Status == ResultStatus.NotFound)
                    return Results.NotFound();
                return Results.Accepted($"/api/jobs/{result.Value.JobId}",
                    new ImportTriggeredResponse(result.Value.JobId));
            });
    }
}
