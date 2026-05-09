namespace Contexteur.UseCases.Import.TriggerImport;

public record TriggerImportCommand(Guid SourceId);
public record TriggerImportResult(Guid JobId);
