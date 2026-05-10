using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

namespace Gravion.Noesis.UseCases.Jobs.ListJobs;

public class ListJobsHandler(IJobRepository jobs)
{
    public async Task<Result<List<Job>>> Handle(ListJobsQuery query, CancellationToken ct)
        => await jobs.ListRecentAsync(query.Limit, ct);
}
