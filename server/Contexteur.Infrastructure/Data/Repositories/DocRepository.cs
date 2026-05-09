using Contexteur.Core.Entities;
using Contexteur.Core.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace Contexteur.Infrastructure.Data.Repositories;

public class DocRepository(AppDbContext db) : IDocRepository
{
    public async Task<Doc> AddAsync(Doc doc, CancellationToken ct = default)
    {
        db.Docs.Add(doc);
        await db.SaveChangesAsync(ct);
        return doc;
    }

    public async Task DeleteBySourceAsync(Guid sourceId, CancellationToken ct = default)
    {
        await db.Docs.Where(d => d.SourceId == sourceId).ExecuteDeleteAsync(ct);
    }
}
