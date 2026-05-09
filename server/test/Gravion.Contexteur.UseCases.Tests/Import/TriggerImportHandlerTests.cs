using Ardalis.Result;

using FluentAssertions;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;
using Gravion.Contexteur.UseCases.Crawling;
using Gravion.Contexteur.UseCases.Import.TriggerImport;

using NSubstitute;

using Wolverine;

namespace Gravion.Contexteur.UseCases.Tests.Import;

[TestFixture]
public class TriggerImportHandlerTests
{
    private IMessageBus _bus = null!;
    private TriggerImportHandler _handler = null!;
    private IJobRepository _jobs = null!;
    private ISourceRepository _sources = null!;

    [SetUp]
    public void SetUp()
    {
        _sources = Substitute.For<ISourceRepository>();
        _jobs = Substitute.For<IJobRepository>();
        _bus = Substitute.For<IMessageBus>();
        _handler = new TriggerImportHandler(_sources, _jobs, _bus);
    }

    [Test]
    public async Task Handle_WhenSourceExists_CreatesJobAndPublishesSaga()
    {
        var sourceId = Guid.NewGuid();
        var source = new Source { Id = sourceId, Url = "https://example.com/llms.txt", ImporterType = "llmstxt" };
        _sources.GetByIdAsync(sourceId, Arg.Any<CancellationToken>()).Returns(source);
        _jobs.AddAsync(Arg.Any<Job>(), Arg.Any<CancellationToken>())
            .Returns(call => call.Arg<Job>());

        var result = await _handler.Handle(new TriggerImportCommand(sourceId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.JobId.Should().NotBe(Guid.Empty);
        await _jobs.Received(1)
            .AddAsync(
                Arg.Is<Job>(j => j.SourceId == sourceId && j.Type == "import" && j.Status == "pending"),
                Arg.Any<CancellationToken>());
        await _bus.Received(1).PublishAsync(Arg.Is<StartImportSaga>(s => s.SourceId == sourceId));
    }

    [Test]
    public async Task Handle_WhenSourceNotFound_ReturnsNotFound()
    {
        _sources.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Source?)null);

        var result = await _handler.Handle(new TriggerImportCommand(Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(ResultStatus.NotFound);
        await _bus.DidNotReceive().PublishAsync(Arg.Any<object>());
    }

    [Test]
    public void Handle_WithEmptySourceId_ThrowsArgumentException()
    {
        var act = async () => await _handler.Handle(new TriggerImportCommand(Guid.Empty), CancellationToken.None);

        act.Should().ThrowAsync<ArgumentException>();
    }
}
