using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;

using LiteBus.Commands.Abstractions;

namespace Gravion.Noesis.UseCases.Sources.DeleteSource;

public class DeleteSourceHandler(ISourceRepository sources) : ICommandHandler<DeleteSourceCommand, Result>
{
    public async Task<Result> HandleAsync(DeleteSourceCommand cmd, CancellationToken cancellationToken = default)
    {
        Guard.Against.Default(cmd.Id, nameof(cmd.Id));

        await sources.DeleteAsync(cmd.Id, cancellationToken);
        return Result.Success();
    }
}
