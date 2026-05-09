using FluentAssertions;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;
using Gravion.Contexteur.UseCases.Sources.ListSources;

using NSubstitute;

namespace Gravion.Contexteur.UseCases.Tests.Sources;

[TestFixture]
public class ListSourcesHandlerTests
{
    private ListSourcesHandler _handler = null!;
    private ISourceRepository _sources = null!;

    [SetUp]
    public void SetUp()
    {
        _sources = Substitute.For<ISourceRepository>();
        _handler = new ListSourcesHandler(_sources);
    }

    [Test]
    public async Task Handle_ReturnsSources_FromRepository()
    {
        var expected = new List<Source>
        {
            new() { Id = Guid.NewGuid(), Name = "Source A" },
            new() { Id = Guid.NewGuid(), Name = "Source B" }
        };
        _sources.ListAsync(Arg.Any<CancellationToken>()).Returns(expected);

        var result = await _handler.Handle(new ListSourcesQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
        result.Value.Should().ContainSingle(s => s.Name == "Source A");
        result.Value.Should().ContainSingle(s => s.Name == "Source B");
    }

    [Test]
    public async Task Handle_WhenNoSources_ReturnsEmptyList()
    {
        _sources.ListAsync(Arg.Any<CancellationToken>()).Returns([]);

        var result = await _handler.Handle(new ListSourcesQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }
}
