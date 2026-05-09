using Ardalis.Result;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;

namespace Gravion.Contexteur.UseCases.Jobs.ListJobs;

public class ListJobsHandler(IJobRepository jobs)
{
    public async Task<Result<List<Job>>> Handle(ListJobsQuery query, CancellationToken ct)
        => await jobs.ListRecentAsync(query.Limit, ct);
}
