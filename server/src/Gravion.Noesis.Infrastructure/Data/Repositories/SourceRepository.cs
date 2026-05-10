using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using Microsoft.EntityFrameworkCore;

namespace Gravion.Noesis.Infrastructure.Data.Repositories;

public class SourceRepository(AppDbContext db) : ISourceRepository
{
    public Task<Source?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.Sources.FindAsync([id], ct).AsTask();

    public Task<List<Source>> ListAsync(CancellationToken ct = default)
        => db.Sources.OrderBy(s => s.Name).ToListAsync(ct);

    public async Task<Source> AddAsync(Source source, CancellationToken ct = default)
    {
        db.Sources.Add(source);
        await db.SaveChangesAsync(ct);
        return source;
    }

    public async Task<Source> UpdateAsync(Source source, CancellationToken ct = default)
    {
        source.UpdatedAt = DateTime.UtcNow;
        db.Sources.Update(source);
        await db.SaveChangesAsync(ct);
        return source;
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var source = await db.Sources.FindAsync([id], ct);
        if (source is not null)
        {
            db.Sources.Remove(source);
            await db.SaveChangesAsync(ct);
        }
    }
}
