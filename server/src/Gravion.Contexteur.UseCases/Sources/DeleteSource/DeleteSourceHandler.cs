using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Contexteur.Core.Abstractions;

namespace Gravion.Contexteur.UseCases.Sources.DeleteSource;

public class DeleteSourceHandler(ISourceRepository sources)
{
    public async Task<Result> Handle(DeleteSourceCommand cmd, CancellationToken ct)
    {
        Guard.Against.Default(cmd.Id, nameof(cmd.Id));

        await sources.DeleteAsync(cmd.Id, ct);
        return Result.Success();
    }
}
