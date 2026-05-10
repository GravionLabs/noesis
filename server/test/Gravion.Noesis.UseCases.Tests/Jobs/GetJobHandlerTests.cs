using Ardalis.Result;

using FluentAssertions;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Jobs.GetJob;

using NSubstitute;

namespace Gravion.Noesis.UseCases.Tests.Jobs;

[TestFixture]
public class GetJobHandlerTests
{
    private GetJobHandler _handler = null!;
    private IJobRepository _jobs = null!;

    [SetUp]
    public void SetUp()
    {
        _jobs = Substitute.For<IJobRepository>();
        _handler = new GetJobHandler(_jobs);
    }

    [Test]
    public async Task Handle_WhenJobExists_ReturnsJob()
    {
        var id = Guid.NewGuid();
        var job = new Job { Id = id, Type = "import", Status = "done" };
        _jobs.GetByIdAsync(id, Arg.Any<CancellationToken>()).Returns(job);

        var result = await _handler.Handle(new GetJobQuery(id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Id.Should().Be(id);
        result.Value.Status.Should().Be("done");
    }

    [Test]
    public async Task Handle_WhenJobNotFound_ReturnsNotFound()
    {
        _jobs.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Job?)null);

        var result = await _handler.Handle(new GetJobQuery(Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(ResultStatus.NotFound);
    }

    [Test]
    public void Handle_WithEmptyId_ThrowsArgumentException()
    {
        var act = async () => await _handler.Handle(new GetJobQuery(Guid.Empty), CancellationToken.None);

        act.Should().ThrowAsync<ArgumentException>();
    }
}
