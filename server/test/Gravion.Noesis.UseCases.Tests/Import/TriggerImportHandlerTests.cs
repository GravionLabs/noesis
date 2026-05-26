using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Crawling;
using Gravion.Noesis.UseCases.Import.TriggerImport;

using MassTransit;

using NSubstitute;

namespace Gravion.Noesis.UseCases.Tests.Import;

[TestFixture]
public class TriggerImportHandlerTests
{
    private IPublishEndpoint _publishEndpoint = null!;
    private TriggerImportHandler _handler = null!;
    private IJobRepository _jobs = null!;
    private ISourceRepository _sources = null!;

    [SetUp]
    public void SetUp()
    {
        _sources = Substitute.For<ISourceRepository>();
        _jobs = Substitute.For<IJobRepository>();
        _publishEndpoint = Substitute.For<IPublishEndpoint>();
        _handler = new TriggerImportHandler(_sources, _jobs, _publishEndpoint);
    }

    [Test]
    public async Task Handle_WhenSourceExists_CreatesJobAndPublishesSaga()
    {
        var sourceId = Guid.NewGuid();
        var source = new Source { Id = sourceId, Url = "https://example.com/llms.txt", ImporterType = "llmstxt" };
        _sources.GetByIdAsync(sourceId, Arg.Any<CancellationToken>()).Returns(source);
        _jobs.AddAsync(Arg.Any<Job>(), Arg.Any<CancellationToken>())
            .Returns(call => call.Arg<Job>());

        var result = await _handler.HandleAsync(new TriggerImportCommand(sourceId), CancellationToken.None);

        result.IsSuccess.ShouldBeTrue();
        result.Value.JobId.ShouldNotBe(Guid.Empty);
        await _jobs.Received(1)
            .AddAsync(
                Arg.Is<Job>(j => j.SourceId == sourceId && j.Type == "import" && j.Status == "pending"),
                Arg.Any<CancellationToken>());
        await _publishEndpoint.Received(1).Publish(Arg.Is<StartImportSaga>(s => s.SourceId == sourceId), Arg.Any<CancellationToken>());
    }

    [Test]
    public async Task Handle_WhenSourceNotFound_ReturnsNotFound()
    {
        _sources.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Source?)null);

        var result = await _handler.HandleAsync(new TriggerImportCommand(Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.ShouldBeFalse();
        result.Status.ShouldBe(ResultStatus.NotFound);
        await _publishEndpoint.DidNotReceive().Publish(Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Test]
    public void Handle_WithEmptySourceId_ThrowsArgumentException()
    {
        var act = async () => await _handler.HandleAsync(new TriggerImportCommand(Guid.Empty), CancellationToken.None);

        Should.Throw<ArgumentException>(() => act().GetAwaiter().GetResult());
    }
}
