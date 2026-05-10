using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

using Microsoft.EntityFrameworkCore;

namespace Gravion.Noesis.Infrastructure.Data.Repositories;

public class DocRepository(AppDbContext db) : IDocRepository
{
    public async Task<Doc> AddAsync(Doc doc, CancellationToken ct = default)
    {
        db.Docs.Add(doc);
        await db.SaveChangesAsync(ct);
        return doc;
    }

    public async Task DeleteBySourceAsync(Guid sourceId, CancellationToken ct = default) =>
        await db.Docs.Where(d => d.SourceId == sourceId).ExecuteDeleteAsync(ct);
}
