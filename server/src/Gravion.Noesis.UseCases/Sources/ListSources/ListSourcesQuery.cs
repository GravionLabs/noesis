using Ardalis.Result;

using Gravion.Noesis.Core.Entities;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Sources.ListSources;

public record ListSourcesQuery : IQuery<Result<List<Source>>>;
