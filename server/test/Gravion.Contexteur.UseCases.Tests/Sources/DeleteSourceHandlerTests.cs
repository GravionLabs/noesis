using FluentAssertions;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.UseCases.Sources.DeleteSource;

using NSubstitute;

namespace Gravion.Contexteur.UseCases.Tests.Sources;

[TestFixture]
public class DeleteSourceHandlerTests
{
    private DeleteSourceHandler _handler = null!;
    private ISourceRepository _sources = null!;

    [SetUp]
    public void SetUp()
    {
        _sources = Substitute.For<ISourceRepository>();
        _handler = new DeleteSourceHandler(_sources);
    }

    [Test]
    public async Task Handle_WithValidId_CallsDeleteAsync()
    {
        var id = Guid.NewGuid();
        var cmd = new DeleteSourceCommand(id);

        var result = await _handler.Handle(cmd, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _sources.Received(1).DeleteAsync(id, Arg.Any<CancellationToken>());
    }

    [Test]
    public void Handle_WithEmptyId_ThrowsArgumentException()
    {
        var cmd = new DeleteSourceCommand(Guid.Empty);

        var act = async () => await _handler.Handle(cmd, CancellationToken.None);

        act.Should().ThrowAsync<ArgumentException>();
    }
}
