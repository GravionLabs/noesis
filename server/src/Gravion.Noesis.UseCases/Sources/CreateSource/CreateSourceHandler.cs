using Ardalis.GuardClauses;
using Ardalis.Result;

using Gravion.Noesis.Core.Abstractions;
using Gravion.Noesis.Core.Entities;

namespace Gravion.Noesis.UseCases.Sources.CreateSource;

public class CreateSourceHandler(ISourceRepository sources)
{
    private readonly ISourceRepository _sources = Guard.Against.Null(sources);

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
        return await _sources.AddAsync(source, ct);
    }
}
