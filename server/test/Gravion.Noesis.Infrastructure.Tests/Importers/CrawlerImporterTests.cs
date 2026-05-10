using FluentAssertions;

using Gravion.Noesis.Core.Entities;
using Gravion.Noesis.Core.Events;
using Gravion.Noesis.Core.Models;
using Gravion.Noesis.Infrastructure.Importers;

using Microsoft.Extensions.Logging;

using NSubstitute;

using Wolverine;

namespace Gravion.Noesis.Infrastructure.Tests.Importers;

[TestFixture]
public class CrawlerImporterTests
{
    private IMessageBus _bus = null!;
    private CrawlerImporter _importer = null!;
    private ILogger<CrawlerImporter> _logger = null!;

    [SetUp]
    public void SetUp()
    {
        _bus = Substitute.For<IMessageBus>();
        _logger = Substitute.For<ILogger<CrawlerImporter>>();
        _importer = new CrawlerImporter(_bus, _logger);
    }

    [Test]
    public void ImporterType_IsCrawler() => _importer.ImporterType.Should().Be("crawler");

    [Test]
    public async Task ImportAsync_PublishesStartCrawlJob_AndReturnsWaitForCallback()
    {
        var jobId = Guid.NewGuid();
        var source = new Source { Id = Guid.NewGuid(), Url = "https://docs.example.com", ImporterType = "crawler" };
        var context = new ImportContext(jobId);

        var result = await _importer.ImportAsync(source, context);

        result.IsSuccess.Should().BeTrue();
        result.Value.WaitForCallback.Should().BeTrue();
        await _bus.Received(1).PublishAsync(Arg.Is<StartCrawlJob>(m =>
            m.JobId == jobId &&
            m.SourceId == source.Id &&
            m.Url == source.Url &&
            m.Type == source.ImporterType));
    }
}
