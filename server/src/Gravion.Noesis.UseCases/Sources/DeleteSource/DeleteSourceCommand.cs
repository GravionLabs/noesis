using Ardalis.Result;

using LiteBus.Commands.Abstractions;

namespace Gravion.Noesis.UseCases.Sources.DeleteSource;

public record DeleteSourceCommand(Guid Id) : ICommand<Result>;
