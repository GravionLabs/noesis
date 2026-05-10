using Gravion.Noesis.Core.Entities;

namespace Gravion.Noesis.Core.Abstractions;

public interface IChunkRepository
{
    Task<List<Chunk>> SearchByTextAsync(string query, int limit, string? sourceName, CancellationToken ct = default);
    Task<Chunk?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Chunk> AddAsync(Chunk chunk, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<Chunk> chunks, CancellationToken ct = default);
    Task DeleteBySourceAsync(Guid sourceId, CancellationToken ct = default);
}
