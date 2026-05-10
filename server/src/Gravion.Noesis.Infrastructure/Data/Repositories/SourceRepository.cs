using Ardalis.GuardClauses;
using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using Microsoft.EntityFrameworkCore;

namespace Gravion.Noesis.Infrastructure.Data.Repositories;

public class SourceRepository(AppDbContext db) : ISourceRepository
{
    private readonly AppDbContext _db = Guard.Against.Null(db);

    public Task<Source?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.Sources.FindAsync([id], ct).AsTask();

    public Task<List<Source>> ListAsync(CancellationToken ct = default)
        => _db.Sources.OrderBy(s => s.Name).ToListAsync(ct);

    public async Task<Source> AddAsync(Source source, CancellationToken ct = default)
    {
        _db.Sources.Add(source);
        await _db.SaveChangesAsync(ct);
        return source;
    }

    public async Task<Source> UpdateAsync(Source source, CancellationToken ct = default)
    {
        source.UpdatedAt = DateTime.UtcNow;
        _db.Sources.Update(source);
        await _db.SaveChangesAsync(ct);
        return source;
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var source = await _db.Sources.FindAsync([id], ct);
        if (source is not null)
        {
            _db.Sources.Remove(source);
            await _db.SaveChangesAsync(ct);
        }
    }
}
