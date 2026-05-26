using Ardalis.Result;

using Gravion.Noesis.Core.Entities;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Jobs.GetJob;

public record GetJobQuery(Guid Id) : IQuery<Result<Job>>;
