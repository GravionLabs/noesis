using Contexteur.Core.Entities;

namespace Contexteur.Core.Interfaces;

public interface IDocRepository
{
    Task<Doc> AddAsync(Doc doc, CancellationToken ct = default);
    Task DeleteBySourceAsync(Guid sourceId, CancellationToken ct = default);
}
