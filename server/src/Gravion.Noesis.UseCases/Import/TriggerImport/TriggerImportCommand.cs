using Ardalis.Result;

using LiteBus.Commands.Abstractions;

namespace Gravion.Noesis.UseCases.Import.TriggerImport;

public record TriggerImportCommand(Guid SourceId) : ICommand<Result<TriggerImportResult>>;
