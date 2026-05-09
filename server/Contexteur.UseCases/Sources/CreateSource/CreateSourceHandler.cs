using Contexteur.Core.Entities;
using Contexteur.Core.Interfaces;

namespace Contexteur.UseCases.Sources.CreateSource;

public class CreateSourceHandler(ISourceRepository sources)
{
    public async Task<Source> Handle(CreateSourceCommand cmd, CancellationToken ct)
    {
        var source = new Source { Name = cmd.Name, Url = cmd.Url, ImporterType = cmd.ImporterType, Config = cmd.Config, Schedule = cmd.Schedule };
        return await sources.AddAsync(source, ct);
    }
}
