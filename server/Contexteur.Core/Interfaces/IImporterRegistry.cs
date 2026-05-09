namespace Contexteur.Core.Interfaces;

public interface IImporterRegistry
{
    IImporter GetImporter(string importerType);
    IReadOnlyCollection<string> RegisteredTypes { get; }
}
