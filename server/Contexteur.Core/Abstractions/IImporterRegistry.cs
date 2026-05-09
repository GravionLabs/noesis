namespace Contexteur.Core.Abstractions;

public interface IImporterRegistry
{
    IImporter GetImporter(string importerType);
    IReadOnlyCollection<string> RegisteredTypes { get; }
}
