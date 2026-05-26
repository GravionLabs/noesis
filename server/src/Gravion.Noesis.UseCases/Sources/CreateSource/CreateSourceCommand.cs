using Ardalis.Result;

using Gravion.Noesis.Core.Entities;

using LiteBus.Commands.Abstractions;

namespace Gravion.Noesis.UseCases.Sources.CreateSource;

public record CreateSourceCommand(
    string Name,
    string Url,
    string ImporterType = "llmstxt",
    string? Config = null,
    string? Schedule = null) : ICommand<Result<Source>>;
