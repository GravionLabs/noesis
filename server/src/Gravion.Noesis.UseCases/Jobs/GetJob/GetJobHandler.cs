using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using LiteBus.Queries.Abstractions;

namespace Gravion.Noesis.UseCases.Jobs.GetJob;

public class GetJobHandler(IJobRepository jobs) : IQueryHandler<GetJobQuery, Result<Job>>
{
    public async Task<Result<Job>> HandleAsync(GetJobQuery query, CancellationToken cancellationToken = default)
    {
        Guard.Against.Null(query);
        Guard.Against.Default(query.Id, nameof(query.Id));

        var job = await jobs.GetByIdAsync(query.Id, cancellationToken);
        if (job is null)
            return Result.NotFound();

        return job;
    }
}
