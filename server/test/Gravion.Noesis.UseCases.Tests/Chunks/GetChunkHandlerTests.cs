using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.UseCases.Chunks.GetChunk;

using NSubstitute;

namespace Gravion.Noesis.UseCases.Tests.Chunks;

[TestFixture]
public class GetChunkHandlerTests
{
    private IChunkRepository _chunks = null!;
    private GetChunkHandler _handler = null!;

    [SetUp]
    public void SetUp()
    {
        _chunks = Substitute.For<IChunkRepository>();
        _handler = new GetChunkHandler(_chunks);
    }

    [Test]
    public async Task Handle_WhenChunkExists_ReturnsChunkResult()
    {
        var chunkId = Guid.NewGuid();
        var source = new Source { Id = Guid.NewGuid(), Name = "Test Source" };
        var doc = new Doc { Id = Guid.NewGuid(), Url = "https://example.com/doc", Source = source };
        var chunk = new Chunk
        {
            Id = chunkId,
            DocId = doc.Id,
            SourceId = source.Id,
            Content = "Some important content",
            Heading = "Introduction",
            HeadingPath = ["Introduction"],
            ChunkIndex = 2,
            Doc = doc
        };
        _chunks.GetByIdAsync(chunkId, Arg.Any<CancellationToken>()).Returns(chunk);

        var result = await _handler.HandleAsync(new GetChunkQuery(chunkId), CancellationToken.None);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Id.ShouldBe(chunkId);
        result.Value.Content.ShouldBe("Some important content");
        result.Value.Heading.ShouldBe("Introduction");
        result.Value.SourceName.ShouldBe("Test Source");
        result.Value.DocUrl.ShouldBe("https://example.com/doc");
        result.Value.ChunkIndex.ShouldBe(2);
    }

    [Test]
    public async Task Handle_WhenChunkNotFound_ReturnsNotFound()
    {
        _chunks.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Chunk?)null);

        var result = await _handler.HandleAsync(new GetChunkQuery(Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.ShouldBeFalse();
        result.Status.ShouldBe(ResultStatus.NotFound);
    }

    [Test]
    public void Handle_WithEmptyChunkId_ThrowsArgumentException()
    {
        var act = async () => await _handler.HandleAsync(new GetChunkQuery(Guid.Empty), CancellationToken.None);

        Should.Throw<ArgumentException>(() => act().GetAwaiter().GetResult());
    }
}
