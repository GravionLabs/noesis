using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Contexteur.Core.Abstractions;
using Gravion.Contexteur.Core.Entities;

namespace Gravion.Contexteur.UseCases.Sources.CreateSource;

public class CreateSourceHandler(ISourceRepository sources)
{
    public async Task<Result<Source>> Handle(CreateSourceCommand cmd, CancellationToken ct)
    {
        Guard.Against.NullOrEmpty(cmd.Name, nameof(cmd.Name));
        Guard.Against.NullOrEmpty(cmd.Url, nameof(cmd.Url));

        var source = new Source
        {
            Name = cmd.Name,
            Url = cmd.Url,
            ImporterType = cmd.ImporterType,
            Config = cmd.Config,
            Schedule = cmd.Schedule
        };
        return await sources.AddAsync(source, ct);
    }
}
