namespace Gravion.Noesis.Core.Entities;

public class Chunk
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid DocId { get; set; }
    public Doc Doc { get; set; } = null!;
    public Guid SourceId { get; set; }
    public string Content { get; set; } = "";
    public string? Heading { get; set; }
    public string[]? HeadingPath { get; set; }
    public int ChunkIndex { get; set; }
    public int? TokenCount { get; set; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public ICollection<Embedding> Embeddings { get; } = [];
}
