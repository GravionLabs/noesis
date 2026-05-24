using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Sources.CreateSource;

using NSubstitute;

namespace Gravion.Noesis.UseCases.Tests.Sources;

[TestFixture]
public class CreateSourceHandlerTests
{
    private CreateSourceHandler _handler = null!;
    private ISourceRepository _sources = null!;

    [SetUp]
    public void SetUp()
    {
        _sources = Substitute.For<ISourceRepository>();
        _handler = new CreateSourceHandler(_sources);
    }

    [Test]
    public async Task Handle_WithValidCommand_CreatesSourceWithCorrectProperties()
    {
        var cmd = new CreateSourceCommand("My Docs", "https://example.com/llms.txt", "llmstxt", null, "0 0 * * *");
        _sources.AddAsync(Arg.Any<Source>(), Arg.Any<CancellationToken>())
            .Returns(call => call.Arg<Source>());

        var result = await _handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Name.ShouldBe("My Docs");
        result.Value.Url.ShouldBe("https://example.com/llms.txt");
        result.Value.ImporterType.ShouldBe("llmstxt");
        result.Value.Schedule.ShouldBe("0 0 * * *");
    }

    [Test]
    public async Task Handle_WithValidCommand_CallsAddAsync()
    {
        var cmd = new CreateSourceCommand("Test", "https://example.com");
        _sources.AddAsync(Arg.Any<Source>(), Arg.Any<CancellationToken>())
            .Returns(call => call.Arg<Source>());

        await _handler.Handle(cmd, CancellationToken.None);

        await _sources.Received(1)
            .AddAsync(
                Arg.Is<Source>(s => s.Name == "Test" && s.Url == "https://example.com"),
                Arg.Any<CancellationToken>());
    }

    [Test]
    public void Handle_WithEmptyName_ThrowsArgumentException()
    {
        var cmd = new CreateSourceCommand("", "https://example.com");

        var act = async () => await _handler.Handle(cmd, CancellationToken.None);

        Should.Throw<ArgumentException>(() => act().GetAwaiter().GetResult());
    }

    [Test]
    public void Handle_WithEmptyUrl_ThrowsArgumentException()
    {
        var cmd = new CreateSourceCommand("Test Source", "");

        var act = async () => await _handler.Handle(cmd, CancellationToken.None);

        Should.Throw<ArgumentException>(() => act().GetAwaiter().GetResult());
    }
}
