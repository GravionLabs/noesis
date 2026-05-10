using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

namespace Gravion.Noesis.UseCases.Jobs.GetJob;

public class GetJobHandler(IJobRepository jobs)
{
    public async Task<Result<Job>> Handle(GetJobQuery query, CancellationToken ct)
    {
        Guard.Against.Default(query.Id, nameof(query.Id));

        var job = await jobs.GetByIdAsync(query.Id, ct);
        if (job is null)
            return Result.NotFound();

        return job;
    }
}
