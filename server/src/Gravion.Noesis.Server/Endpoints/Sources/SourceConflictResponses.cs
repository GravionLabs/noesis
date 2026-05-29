using System.Text.Json;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using Npgsql;

namespace Gravion.Noesis.Server.Endpoints.Sources;

public static class SourceConflictResponses
{
    private const string UniqueViolationSqlState = "23505";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static bool IsUniqueConstraintViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgresException &&
                postgresException.SqlState == UniqueViolationSqlState)
            {
                return true;
            }
        }

        return false;
    }

    public static IResult DuplicateSource()
    {
        return new ProblemDetailsResult(new ProblemDetails
        {
            Title = "Source already exists",
            Detail = "A source with the same URL already exists.",
            Status = StatusCodes.Status409Conflict,
            Type = "https://httpstatuses.com/409"
        });
    }

    private sealed class ProblemDetailsResult(ProblemDetails problemDetails) : IResult
    {
        private readonly ProblemDetails _problemDetails = problemDetails;

        public async Task ExecuteAsync(HttpContext httpContext)
        {
            httpContext.Response.StatusCode = _problemDetails.Status ?? StatusCodes.Status500InternalServerError;
            httpContext.Response.ContentType = "application/problem+json";

            await JsonSerializer.SerializeAsync(
                httpContext.Response.Body,
                _problemDetails,
                _problemDetails.GetType(),
                JsonOptions);
        }
    }
}
