namespace Contexteur.Core.Models;

/// <param name="JobId">Saga/Job ID for correlation and callbacks.</param>
public record ImportContext(Guid JobId);
