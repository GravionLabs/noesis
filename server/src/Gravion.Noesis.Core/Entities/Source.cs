namespace Gravion.Noesis.Core.Entities;

public class Source
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
    public string ImporterType { get; set; } = "llmstxt"; // llmstxt | github | azuredevops | crawler
    public bool Enabled { get; set; } = true;
    public string? Config { get; set; } // importer-specific JSON config
    public string? Schedule { get; set; } // Hangfire cron expression, null = manual only
    public DateTime? LastImportedAt { get; set; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Doc> Docs { get; } = [];
    public ICollection<Job> Jobs { get; } = [];
}
