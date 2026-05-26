using Gravion.Noesis.Core.Events;
using Gravion.Noesis.UseCases.Crawling;

using MassTransit;
using MassTransit.Testing;

using Microsoft.Extensions.DependencyInjection;

namespace Gravion.Noesis.UseCases.Tests.Crawling;

/// <summary>
///     Verifies that the <see cref="ImportJobStateMachine"/> routes events correctly
///     and performs the expected state transitions.
///
///     These tests use an in-memory MassTransit test harness to avoid any real
///     RabbitMQ dependency and to guard against re-introducing the
///     InvalidOperationException that occurred when CrawlCompletedConsumer and
///     EmbedCompletedConsumer were registered both manually AND via ConfigureEndpoints.
/// </summary>
[TestFixture]
[Category("MassTransit")]
public class ImportJobStateMachineTests
{
    private ServiceProvider _provider = null!;
    private ITestHarness _harness = null!;
    private ISagaStateMachineTestHarness<ImportJobStateMachine, ImportJobState> _sagaHarness = null!;

    [SetUp]
    public async Task SetUp()
    {
        _provider = new ServiceCollection()
            .AddMassTransitTestHarness(x =>
            {
                x.AddSagaStateMachine<ImportJobStateMachine, ImportJobState>()
                    .InMemoryRepository();
            })
            .BuildServiceProvider(true);

        _harness = _provider.GetRequiredService<ITestHarness>();
        _sagaHarness = _harness.GetSagaStateMachineHarness<ImportJobStateMachine, ImportJobState>();

        await _harness.Start();
    }

    [TearDown]
    public async Task TearDown()
    {
        await _harness.Stop();
        await _provider.DisposeAsync();
    }

    [Test]
    public async Task StartImportSaga_TransitionsToImporting()
    {
        var jobId = Guid.NewGuid();

        await _harness.Bus.Publish(new StartImportSaga(jobId, Guid.NewGuid(), "https://example.com", "llmstxt"));

        var sagaId = await _sagaHarness.Exists(jobId, sm => sm.Importing, timeout: TimeSpan.FromSeconds(5));
        sagaId.ShouldNotBeNull();
    }

    [Test]
    public async Task ImportCompleted_TransitionsToEmbeddingAndPublishesStartEmbedJob()
    {
        var jobId = Guid.NewGuid();
        var sourceId = Guid.NewGuid();

        await _harness.Bus.Publish(new StartImportSaga(jobId, sourceId, "https://example.com", "llmstxt"));
        await _sagaHarness.Exists(jobId, sm => sm.Importing, timeout: TimeSpan.FromSeconds(5));

        await _harness.Bus.Publish(new ImportCompleted(jobId, sourceId, 5, 42));

        var sagaId = await _sagaHarness.Exists(jobId, sm => sm.Embedding, timeout: TimeSpan.FromSeconds(5));
        sagaId.ShouldNotBeNull();

        var startEmbedPublished = await _harness.Published.Any<StartEmbedJob>(
            x => x.Context.Message.JobId == jobId);
        startEmbedPublished.ShouldBeTrue();
    }

    [Test]
    public async Task CrawlCompleted_TransitionsToEmbeddingAndPublishesStartEmbedJob()
    {
        var jobId = Guid.NewGuid();
        var sourceId = Guid.NewGuid();

        await _harness.Bus.Publish(new StartImportSaga(jobId, sourceId, "https://example.com", "crawler"));
        await _sagaHarness.Exists(jobId, sm => sm.Importing, timeout: TimeSpan.FromSeconds(5));

        await _harness.Bus.Publish(new CrawlCompleted(jobId, sourceId, 3, 27));

        var sagaId = await _sagaHarness.Exists(jobId, sm => sm.Embedding, timeout: TimeSpan.FromSeconds(5));
        sagaId.ShouldNotBeNull();

        var startEmbedPublished = await _harness.Published.Any<StartEmbedJob>(
            x => x.Context.Message.JobId == jobId);
        startEmbedPublished.ShouldBeTrue();
    }

    [Test]
    public async Task EmbedCompleted_TransitionsToDone()
    {
        var jobId = Guid.NewGuid();
        var sourceId = Guid.NewGuid();

        await _harness.Bus.Publish(new StartImportSaga(jobId, sourceId, "https://example.com", "llmstxt"));
        await _sagaHarness.Exists(jobId, sm => sm.Importing, timeout: TimeSpan.FromSeconds(5));

        await _harness.Bus.Publish(new ImportCompleted(jobId, sourceId, 1, 10));
        await _sagaHarness.Exists(jobId, sm => sm.Embedding, timeout: TimeSpan.FromSeconds(5));

        await _harness.Bus.Publish(new EmbedCompleted(jobId, sourceId, 10));

        var sagaId = await _sagaHarness.Exists(jobId, sm => sm.Done, timeout: TimeSpan.FromSeconds(5));
        sagaId.ShouldNotBeNull();
    }

    [Test]
    public async Task EmbedCompleted_InWrongState_IsNotConsumedBySaga()
    {
        var jobId = Guid.NewGuid();
        var sourceId = Guid.NewGuid();

        await _harness.Bus.Publish(new StartImportSaga(jobId, sourceId, "https://example.com", "llmstxt"));
        await _sagaHarness.Exists(jobId, sm => sm.Importing, timeout: TimeSpan.FromSeconds(5));

        // EmbedCompleted before ImportCompleted — saga should stay in Importing
        await _harness.Bus.Publish(new EmbedCompleted(jobId, sourceId, 0));

        await Task.Delay(300); // give the harness time to process

        // Saga must still be in Importing, not Done
        var sagaId = await _sagaHarness.Exists(jobId, sm => sm.Importing, timeout: TimeSpan.FromSeconds(3));
        sagaId.ShouldNotBeNull("Saga should still be in Importing state — EmbedCompleted is only valid in Embedding.");
    }
}
