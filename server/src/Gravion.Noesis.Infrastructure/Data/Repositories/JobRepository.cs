using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using Microsoft.EntityFrameworkCore;

namespace Gravion.Noesis.Infrastructure.Data.Repositories;

public class JobRepository(AppDbContext db) : IJobRepository
{
    public Task<Job?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.Jobs.FindAsync([id], ct).AsTask();

    public Task<List<Job>> ListRecentAsync(int limit = 50, CancellationToken ct = default)
        => db.Jobs.OrderByDescending(j => j.CreatedAt).Take(limit).ToListAsync(ct);

    public async Task<Job> AddAsync(Job job, CancellationToken ct = default)
    {
        db.Jobs.Add(job);
        await db.SaveChangesAsync(ct);
        return job;
    }

    public async Task UpdateAsync(Job job, CancellationToken ct = default)
    {
        db.Jobs.Update(job);
        await db.SaveChangesAsync(ct);
    }
}
