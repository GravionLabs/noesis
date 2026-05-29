using System.Text.Json;

using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

using Gravion.Noesis.Server.Endpoints.Sources;

using Npgsql;

namespace Gravion.Noesis.Server.Tests.Sources;

[TestFixture]
public class SourceConflictResponsesTests
{
    [Test]
    public void IsUniqueConstraintViolation_ReturnsTrue_ForPostgresUniqueViolation()
    {
        var postgresException = new PostgresException(
            "duplicate key value violates unique constraint",
            "ERROR",
            "ERROR",
            "23505");
        var exception = new DbUpdateException("save failed", postgresException);

        SourceConflictResponses.IsUniqueConstraintViolation(exception).ShouldBeTrue();
    }

    [Test]
    public void IsUniqueConstraintViolation_ReturnsFalse_ForNonUniqueViolation()
    {
        var postgresException = new PostgresException(
            "foreign key violation",
            "ERROR",
            "ERROR",
            "23503");
        var exception = new DbUpdateException("save failed", postgresException);

        SourceConflictResponses.IsUniqueConstraintViolation(exception).ShouldBeFalse();
    }

    [Test]
    public async Task DuplicateSource_Returns409ProblemDetails()
    {
        var result = SourceConflictResponses.DuplicateSource();
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await result.ExecuteAsync(context);

        context.Response.StatusCode.ShouldBe(StatusCodes.Status409Conflict);
        context.Response.Body.Position = 0;

        using var document = await JsonDocument.ParseAsync(context.Response.Body);
        document.RootElement.GetProperty("title").GetString().ShouldBe("Source already exists");
        document.RootElement.GetProperty("detail").GetString().ShouldBe("A source with the same URL already exists.");
        document.RootElement.GetProperty("status").GetInt32().ShouldBe(StatusCodes.Status409Conflict);
    }
}
