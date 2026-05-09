namespace Gravion.Contexteur.Core.Entities;

public class Embedding
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChunkId { get; set; }
    public Chunk Chunk { get; set; } = null!;
    public string Model { get; set; } = "";

    public int Dimensions { get; set; }

    // Stored as float[] in Core; Infrastructure maps this to the Postgres vector type via a value converter
    public float[]? Vector { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
