using Contexteur.Core.Interfaces;

namespace Contexteur.UseCases.Sources.DeleteSource;

public class DeleteSourceHandler(ISourceRepository sources)
{
    public async Task Handle(DeleteSourceCommand cmd, CancellationToken ct)
        => await sources.DeleteAsync(cmd.Id, ct);
}
