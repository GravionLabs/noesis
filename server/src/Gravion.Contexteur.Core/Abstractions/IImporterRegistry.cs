namespace Gravion.Contexteur.Core.Abstractions;

public interface IImporterRegistry
{
    IReadOnlyCollection<string> RegisteredTypes { get; }
    IImporter GetImporter(string importerType);
}
