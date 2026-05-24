using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Search.SearchDocs;

using NSubstitute;

namespace Gravion.Noesis.UseCases.Tests.Search;

[TestFixture]
public class SearchDocsHandlerTests
{
    private IChunkRepository _chunks = null!;
    private IEmbedQueryClient _embedQuery = null!;
    private SearchDocsHandler _handler = null!;

    [SetUp]
    public void SetUp()
    {
        _chunks = Substitute.For<IChunkRepository>();
        _embedQuery = Substitute.For<IEmbedQueryClient>();
        // Default: embedder unavailable → FTS fallback
        _embedQuery.EmbedQueryAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((EmbedQueryResult?)null);
        _handler = new SearchDocsHandler(_chunks, _embedQuery);
    }

    [Test]
    public async Task Handle_ReturnsMatchingChunks()
    {
        var source = new Source { Name = "API Docs" };
        var doc = new Doc { Url = "https://example.com/api", Source = source };
        var chunk = new Chunk
        {
            Id = Guid.NewGuid(),
            Content = "Authentication overview",
            Heading = "Auth",
            Doc = doc
        };
        _chunks.SearchByTextAsync("authentication", 5, null, Arg.Any<CancellationToken>())
            .Returns([chunk]);

        var result = await _handler.Handle(new SearchDocsQuery("authentication"), CancellationToken.None);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Chunks.Count().ShouldBe(1);
        result.Value.Chunks[0].Content.ShouldBe("Authentication overview");
        result.Value.Chunks[0].SourceName.ShouldBe("API Docs");
        result.Value.Chunks[0].DocUrl.ShouldBe("https://example.com/api");
        result.Value.Chunks[0].Heading.ShouldBe("Auth");
    }

    [Test]
    public async Task Handle_PassesSourceNameFilter_ToRepository()
    {
        _chunks.SearchByTextAsync("query", 10, "My Source", Arg.Any<CancellationToken>()).Returns([]);

        await _handler.Handle(new SearchDocsQuery("query", 10, "My Source"), CancellationToken.None);

        await _chunks.Received(1).SearchByTextAsync("query", 10, "My Source", Arg.Any<CancellationToken>());
    }

    [Test]
    public async Task Handle_WhenNoResults_ReturnsEmptyList()
    {
        _chunks.SearchByTextAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var result = await _handler.Handle(new SearchDocsQuery("nothing here"), CancellationToken.None);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Chunks.ShouldBeEmpty();
    }

    [Test]
    public void Handle_WithEmptyQuery_ThrowsArgumentException()
    {
        var act = async () => await _handler.Handle(new SearchDocsQuery(""), CancellationToken.None);

        Should.Throw<ArgumentException>(() => act().GetAwaiter().GetResult());
    }

    [Test]
    public async Task Handle_WhenEmbedderAvailable_UsesVectorSearch()
    {
        var vector = new float[] { 0.1f, 0.2f, 0.3f };
        var model = "text-embedding-3-small";
        _embedQuery.EmbedQueryAsync("DI", Arg.Any<CancellationToken>()).Returns(new EmbedQueryResult(vector, model));
        _chunks.SearchByVectorAsync(vector, model, 5, null, Arg.Any<CancellationToken>()).Returns([]);

        await _handler.Handle(new SearchDocsQuery("DI"), CancellationToken.None);

        await _chunks.Received(1).SearchByVectorAsync(vector, model, 5, null, Arg.Any<CancellationToken>());
        await _chunks.DidNotReceive().SearchByTextAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }
}
