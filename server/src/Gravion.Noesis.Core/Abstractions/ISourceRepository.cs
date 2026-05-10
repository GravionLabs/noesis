using Gravion.Noesis.Core.Entities;

namespace Gravion.Noesis.Core.Abstractions;

public interface ISourceRepository
{
    Task<Source?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<Source>> ListAsync(CancellationToken ct = default);
    Task<Source> AddAsync(Source source, CancellationToken ct = default);
    Task<Source> UpdateAsync(Source source, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
