namespace Contexteur.Core.Entities;

public class Source
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
    public string ImporterType { get; set; } = "llmstxt"; // llmstxt | github | azuredevops | crawler
    public bool Enabled { get; set; } = true;
    public string? Config { get; set; }          // importer-specific JSON config
    public string? Schedule { get; set; }         // Hangfire cron expression, null = manual only
    public DateTime? LastImportedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Doc> Docs { get; set; } = [];
    public ICollection<Job> Jobs { get; set; } = [];
}

