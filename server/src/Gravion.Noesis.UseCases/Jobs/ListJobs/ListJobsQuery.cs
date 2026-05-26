using Ardalis.Result;

using Gravion.Noesis.Core.Entities;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Jobs.ListJobs;

public record ListJobsQuery(int Limit = 50) : IQuery<Result<List<Job>>>;
