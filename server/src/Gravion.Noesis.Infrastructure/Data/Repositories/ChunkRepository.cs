using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using Microsoft.EntityFrameworkCore;

using Pgvector;

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

    public async Task<List<Chunk>> SearchByVectorAsync(float[] vector, string model, int limit, string? sourceName, CancellationToken ct = default)
    {
        var pgVector = new Vector(vector);

        // Use pgvector cosine distance to find the nearest chunks.
        // Filter by embedding model to ensure dimension compatibility.
        // EF Core raw SQL is used because EF Core doesn't support vector operators via LINQ.
        var sourceFilter = sourceName is not null
            ? $"AND s.name = '{sourceName.Replace("'", "''")}'"
            : "";

        var ids = await db.Database
            .SqlQuery<Guid>($"""
                SELECT c.id
                FROM chunks c
                JOIN embeddings e ON e.chunk_id = c.id AND e.model = {model}
                JOIN docs d       ON d.id = c.doc_id
                JOIN sources s    ON s.id = d.source_id
                WHERE true {sourceFilter}
                ORDER BY e.vector <=> {pgVector}
                LIMIT {limit}
                """)
            .ToListAsync(ct);

        if (ids.Count == 0)
            return [];

        var chunks = await db.Chunks
            .Include(c => c.Doc)
            .ThenInclude(d => d.Source)
            .Where(c => ids.Contains(c.Id))
            .ToListAsync(ct);

        // Preserve cosine-distance ordering from the SQL query
        return ids.Select(id => chunks.First(c => c.Id == id)).ToList();
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
