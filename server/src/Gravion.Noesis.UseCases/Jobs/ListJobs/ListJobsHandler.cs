using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Jobs.ListJobs;

public class ListJobsHandler(IJobRepository jobs) : IQueryHandler<ListJobsQuery, Result<List<Job>>>
{
    public async Task<Result<List<Job>>> HandleAsync(ListJobsQuery query, CancellationToken cancellationToken = default)
        => await jobs.ListRecentAsync(query.Limit, cancellationToken);
}
