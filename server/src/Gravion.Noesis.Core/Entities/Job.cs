namespace Gravion.Noesis.Core.Entities;

public class Job
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Type { get; set; } = "crawl"; // crawl | embed | full
    public Guid? SourceId { get; set; }
    public Source? Source { get; set; }
    public string Status { get; set; } = "pending"; // pending | running | done | failed
    public string? Error { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
