using FluentAssertions;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Jobs.ListJobs;

using NSubstitute;

namespace Gravion.Noesis.UseCases.Tests.Jobs;

[TestFixture]
public class ListJobsHandlerTests
{
    private ListJobsHandler _handler = null!;
    private IJobRepository _jobs = null!;

    [SetUp]
    public void SetUp()
    {
        _jobs = Substitute.For<IJobRepository>();
        _handler = new ListJobsHandler(_jobs);
    }

    [Test]
    public async Task Handle_ReturnsJobsFromRepository()
    {
        var expected = new List<Job>
        {
            new() { Id = Guid.NewGuid(), Status = "done" },
            new() { Id = Guid.NewGuid(), Status = "running" }
        };
        _jobs.ListRecentAsync(50, Arg.Any<CancellationToken>()).Returns(expected);

        var result = await _handler.Handle(new ListJobsQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Test]
    public async Task Handle_PassesLimitToRepository()
    {
        _jobs.ListRecentAsync(10, Arg.Any<CancellationToken>()).Returns([]);

        await _handler.Handle(new ListJobsQuery(10), CancellationToken.None);

        await _jobs.Received(1).ListRecentAsync(10, Arg.Any<CancellationToken>());
    }

    [Test]
    public async Task Handle_DefaultLimit_Is50()
    {
        _jobs.ListRecentAsync(50, Arg.Any<CancellationToken>()).Returns([]);

        await _handler.Handle(new ListJobsQuery(), CancellationToken.None);

        await _jobs.Received(1).ListRecentAsync(50, Arg.Any<CancellationToken>());
    }
}
