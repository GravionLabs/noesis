using Gravion.Noesis.Core.Entities;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

using Pgvector;

namespace Gravion.Noesis.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Source> Sources => Set<Source>();
    public DbSet<Doc> Docs => Set<Doc>();
    public DbSet<Chunk> Chunks => Set<Chunk>();
    public DbSet<Embedding> Embeddings => Set<Embedding>();
    public DbSet<Job> Jobs => Set<Job>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.HasPostgresExtension("vector");
        var vectorComparer = new ValueComparer<float[]?>(
            (left, right) => VectorEquals(left, right),
            value => VectorHash(value),
            value => value == null ? null : value.ToArray());

        model.Entity<Source>(e =>
        {
            e.ToTable("sources");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Url).HasColumnName("url").IsRequired();
            e.Property(x => x.ImporterType).HasColumnName("importer_type");
            e.Property(x => x.Enabled).HasColumnName("enabled");
            e.Property(x => x.Config).HasColumnName("config");
            e.Property(x => x.Schedule).HasColumnName("schedule");
            e.Property(x => x.LastImportedAt).HasColumnName("last_imported_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasIndex(x => x.Url).IsUnique();
        });

        model.Entity<Doc>(e =>
        {
            e.ToTable("docs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.SourceId).HasColumnName("source_id");
            e.Property(x => x.Url).HasColumnName("url");
            e.Property(x => x.Title).HasColumnName("title");
            e.Property(x => x.ContentMd).HasColumnName("content_md");
            e.Property(x => x.ContentHash).HasColumnName("content_hash");
            e.Property(x => x.IndexedAt).HasColumnName("indexed_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasOne(x => x.Source).WithMany(x => x.Docs).HasForeignKey(x => x.SourceId);
            e.HasIndex(x => new { x.SourceId, x.Url }).IsUnique();
        });

        model.Entity<Chunk>(e =>
        {
            e.ToTable("chunks");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.DocId).HasColumnName("doc_id");
            e.Property(x => x.SourceId).HasColumnName("source_id");
            e.Property(x => x.Content).HasColumnName("content");
            e.Property(x => x.Heading).HasColumnName("heading");
            e.Property(x => x.HeadingPath).HasColumnName("heading_path");
            e.Property(x => x.ChunkIndex).HasColumnName("chunk_index");
            e.Property(x => x.TokenCount).HasColumnName("token_count");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasOne(x => x.Doc).WithMany(x => x.Chunks).HasForeignKey(x => x.DocId);
            e.HasIndex(x => x.SourceId);
        });

        model.Entity<Embedding>(e =>
        {
            e.ToTable("embeddings");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ChunkId).HasColumnName("chunk_id");
            e.Property(x => x.Model).HasColumnName("model");
            e.Property(x => x.Dimensions).HasColumnName("dimensions");
            e.Property(x => x.Vector)
                .HasColumnName("vector")
                .HasColumnType("vector")
                .HasConversion(
                    v => v == null ? null : new Vector(v),
                    v => v == null ? null : v.Memory.ToArray())
                .Metadata.SetValueComparer(vectorComparer);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasOne(x => x.Chunk).WithMany(x => x.Embeddings).HasForeignKey(x => x.ChunkId);
            e.HasIndex(x => new { x.ChunkId, x.Model }).IsUnique();
        });

        model.Entity<Job>(e =>
        {
            e.ToTable("jobs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Type).HasColumnName("type");
            e.Property(x => x.SourceId).HasColumnName("source_id");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Error).HasColumnName("error");
            e.Property(x => x.StartedAt).HasColumnName("started_at");
            e.Property(x => x.FinishedAt).HasColumnName("finished_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasOne(x => x.Source).WithMany(x => x.Jobs).HasForeignKey(x => x.SourceId).IsRequired(false);
            e.HasIndex(x => x.Status);
        });
    }

    private static bool VectorEquals(float[]? left, float[]? right)
    {
        if (left is null || right is null)
            return left is null && right is null;

        return left.SequenceEqual(right);
    }

    private static int VectorHash(float[]? value)
    {
        if (value is null)
            return 0;

        var hash = new HashCode();
        foreach (var item in value)
            hash.Add(item);
        return hash.ToHashCode();
    }
}
