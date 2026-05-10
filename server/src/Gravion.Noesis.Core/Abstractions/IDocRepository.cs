using Gravion.Noesis.Core.Entities;

namespace Gravion.Noesis.Core.Abstractions;

public interface IDocRepository
{
    Task<Doc> AddAsync(Doc doc, CancellationToken ct = default);
    Task DeleteBySourceAsync(Guid sourceId, CancellationToken ct = default);
}
