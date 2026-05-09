namespace Gravion.Contexteur.Core.Entities;

public class Doc
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SourceId { get; set; }
    public Source Source { get; set; } = null!;
    public string Url { get; set; } = "";
    public string? Title { get; set; }
    public string? ContentMd { get; set; }
    public string? ContentHash { get; set; }
    public DateTime? IndexedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Chunk> Chunks { get; set; } = [];
}
