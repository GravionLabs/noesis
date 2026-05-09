using Contexteur.Core.Entities;
using Contexteur.Core.Abstractions;

namespace Contexteur.UseCases.Jobs.GetJob;

public class GetJobHandler(IJobRepository jobs)
{
    public Task<Job?> Handle(GetJobQuery query, CancellationToken ct)
        => jobs.GetByIdAsync(query.Id, ct);
}
