using MassTransit;

namespace Gravion.Noesis.Core.Events;

[EntityName("noesis.start-embed-job")]
public record StartEmbedJob(Guid JobId, Guid SourceId);
