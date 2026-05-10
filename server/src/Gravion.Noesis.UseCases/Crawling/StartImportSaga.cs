namespace Gravion.Noesis.UseCases.Crawling;

/// <summary>Message that starts the import saga. The Id property sets Wolverine's saga identity.</summary>
public record StartImportSaga(Guid JobId, Guid SourceId, string SourceUrl, string ImporterType)
{
    public Guid Id => JobId;
}
