using Contexteur.Core.Entities;

namespace Contexteur.Core.Interfaces;

public interface IJobRepository
{
    Task<Job?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<Job>> ListRecentAsync(int limit = 50, CancellationToken ct = default);
    Task<Job> AddAsync(Job job, CancellationToken ct = default);
    Task UpdateAsync(Job job, CancellationToken ct = default);
}
