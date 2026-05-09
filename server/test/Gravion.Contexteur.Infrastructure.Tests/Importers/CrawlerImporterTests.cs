using FluentAssertions;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;
using Gravion.Contexteur.Core.Models;
using Gravion.Contexteur.Infrastructure.Importers;

using Microsoft.Extensions.Logging;

using NSubstitute;

namespace Gravion.Contexteur.Infrastructure.Tests.Importers;

[TestFixture]
public class CrawlerImporterTests
{
    private ICrawlerClient _crawlerClient = null!;
    private CrawlerImporter _importer = null!;
    private ILogger<CrawlerImporter> _logger = null!;

    [SetUp]
    public void SetUp()
    {
        _crawlerClient = Substitute.For<ICrawlerClient>();
        _logger = Substitute.For<ILogger<CrawlerImporter>>();
        _importer = new CrawlerImporter(_crawlerClient, _logger);
    }

    [Test]
    public void ImporterType_IsCrawler() => _importer.ImporterType.Should().Be("crawler");

    [Test]
    public async Task ImportAsync_WhenCrawlerSucceeds_ReturnsWaitForCallback()
    {
        var source = new Source { Id = Guid.NewGuid(), Url = "https://docs.example.com", ImporterType = "crawler" };
        var context = new ImportContext(Guid.NewGuid());
        _crawlerClient.StartCrawlAsync(context.JobId,
                source.Id,
                source.Url,
                source.ImporterType,
                Arg.Any<CancellationToken>())
            .Returns(new CrawlResult(true, 0, null));

        var result = await _importer.ImportAsync(source, context);

        result.Success.Should().BeTrue();
        result.WaitForCallback.Should().BeTrue();
    }

    [Test]
    public async Task ImportAsync_WhenCrawlerFails_ReturnsFailureWithError()
    {
        var source = new Source { Id = Guid.NewGuid(), Url = "https://docs.example.com", ImporterType = "crawler" };
        var context = new ImportContext(Guid.NewGuid());
        _crawlerClient.StartCrawlAsync(Arg.Any<Guid>(),
                Arg.Any<Guid>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns(new CrawlResult(false, 0, "Connection refused"));

        var result = await _importer.ImportAsync(source, context);

        result.Success.Should().BeFalse();
        result.Error.Should().Be("Connection refused");
        result.WaitForCallback.Should().BeFalse();
    }

    [Test]
    public async Task ImportAsync_PassesCorrectArguments_ToCrawlerClient()
    {
        var jobId = Guid.NewGuid();
        var source = new Source { Id = Guid.NewGuid(), Url = "https://docs.example.com", ImporterType = "crawler" };
        var context = new ImportContext(jobId);
        _crawlerClient.StartCrawlAsync(Arg.Any<Guid>(),
                Arg.Any<Guid>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns(new CrawlResult(true, 0, null));

        await _importer.ImportAsync(source, context);

        await _crawlerClient.Received(1)
            .StartCrawlAsync(
                jobId,
                source.Id,
                source.Url,
                source.ImporterType,
                Arg.Any<CancellationToken>());
    }
}
