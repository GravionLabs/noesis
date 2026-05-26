using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Sources.ListSources;

using NSubstitute;

namespace Gravion.Noesis.UseCases.Tests.Sources;

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

        var result = await _handler.HandleAsync(new ListSourcesQuery(), CancellationToken.None);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Count().ShouldBe(2);
        result.Value.ShouldContain(s => s.Name == "Source A");
        result.Value.ShouldContain(s => s.Name == "Source B");
    }

    [Test]
    public async Task Handle_WhenNoSources_ReturnsEmptyList()
    {
        _sources.ListAsync(Arg.Any<CancellationToken>()).Returns([]);

        var result = await _handler.HandleAsync(new ListSourcesQuery(), CancellationToken.None);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeEmpty();
    }
}
