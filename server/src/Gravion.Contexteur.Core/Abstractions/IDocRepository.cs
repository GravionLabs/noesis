using Gravion.Contexteur.Core.Entities;

namespace Gravion.Contexteur.Core.Abstractions;

public interface IDocRepository
{
    Task<Doc> AddAsync(Doc doc, CancellationToken ct = default);
    Task DeleteBySourceAsync(Guid sourceId, CancellationToken ct = default);
}
