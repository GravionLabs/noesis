using Ardalis.Result;

using LiteBus.Commands.Abstractions;

namespace Gravion.Noesis.UseCases.Crawling.StartCrawlJob;

public record StartCrawlJobCommand(Guid SourceId) : ICommand<Result<StartCrawlJobResult>>;
