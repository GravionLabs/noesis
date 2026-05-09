using Contexteur.Core.Entities;
using Contexteur.Core.Interfaces;

namespace Contexteur.UseCases.Jobs.ListJobs;

public class ListJobsHandler(IJobRepository jobs)
{
    public Task<List<Job>> Handle(ListJobsQuery query, CancellationToken ct)
        => jobs.ListRecentAsync(query.Limit, ct);
}
