using Contexteur.Core.Interfaces;

namespace Contexteur.Infrastructure.Importers;

public class ImporterRegistry(IEnumerable<IImporter> importers) : IImporterRegistry
{
    private readonly Dictionary<string, IImporter> _importers =
        importers.ToDictionary(i => i.ImporterType, StringComparer.OrdinalIgnoreCase);

    public IImporter GetImporter(string importerType)
    {
        if (_importers.TryGetValue(importerType, out var importer))
            return importer;

        throw new InvalidOperationException(
            $"No importer registered for type '{importerType}'. " +
            $"Available types: {string.Join(", ", _importers.Keys)}");
    }

    public IReadOnlyCollection<string> RegisteredTypes => _importers.Keys;
}
