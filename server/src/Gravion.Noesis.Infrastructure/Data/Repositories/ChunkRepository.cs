using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using Microsoft.EntityFrameworkCore;

namespace Gravion.Noesis.Infrastructure.Data.Repositories;

public class ChunkRepository(AppDbContext db) : IChunkRepository
{
    public async Task<List<Chunk>> SearchByTextAsync(string query,
        int limit,
        string? sourceName,
        CancellationToken ct = default)
    {
        var queryable = db.Chunks
            .Include(c => c.Doc)
            .ThenInclude(d => d.Source)
            .Where(c => EF.Functions.ToTsVector("english", c.Content)
                .Matches(EF.Functions.PlainToTsQuery("english", query)));

        if (sourceName is not null)
            queryable = queryable.Where(c => c.Doc.Source.Name == sourceName);

        return await queryable
            .OrderByDescending(c => EF.Functions.ToTsVector("english", c.Content)
                .Rank(EF.Functions.PlainToTsQuery("english", query)))
            .Take(limit)
            .ToListAsync(ct);
    }

    public async Task<Chunk?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await db.Chunks
            .Include(c => c.Doc)
            .ThenInclude(d => d.Source)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task<Chunk> AddAsync(Chunk chunk, CancellationToken ct = default)
    {
        db.Chunks.Add(chunk);
        await db.SaveChangesAsync(ct);
        return chunk;
    }

    public async Task AddRangeAsync(IEnumerable<Chunk> chunks, CancellationToken ct = default)
    {
        db.Chunks.AddRange(chunks);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteBySourceAsync(Guid sourceId, CancellationToken ct = default) =>
        await db.Chunks.Where(c => c.SourceId == sourceId).ExecuteDeleteAsync(ct);
}
