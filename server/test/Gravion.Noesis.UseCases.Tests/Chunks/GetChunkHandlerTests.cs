using Ardalis.Result;

using FluentAssertions;

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

        var result = await _handler.Handle(new GetChunkQuery(chunkId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Id.Should().Be(chunkId);
        result.Value.Content.Should().Be("Some important content");
        result.Value.Heading.Should().Be("Introduction");
        result.Value.SourceName.Should().Be("Test Source");
        result.Value.DocUrl.Should().Be("https://example.com/doc");
        result.Value.ChunkIndex.Should().Be(2);
    }

    [Test]
    public async Task Handle_WhenChunkNotFound_ReturnsNotFound()
    {
        _chunks.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Chunk?)null);

        var result = await _handler.Handle(new GetChunkQuery(Guid.NewGuid()), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(ResultStatus.NotFound);
    }

    [Test]
    public void Handle_WithEmptyChunkId_ThrowsArgumentException()
    {
        var act = async () => await _handler.Handle(new GetChunkQuery(Guid.Empty), CancellationToken.None);

        act.Should().ThrowAsync<ArgumentException>();
    }
}
