using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace Gravion.Noesis.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "import_job_states",
                columns: table => new
                {
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_state = table.Column<string>(type: "text", nullable: true),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    importer_type = table.Column<string>(type: "text", nullable: false),
                    doc_count = table.Column<int>(type: "integer", nullable: false),
                    chunk_count = table.Column<int>(type: "integer", nullable: false),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_job_states", x => x.correlation_id);
                });

            migrationBuilder.CreateTable(
                name: "sources",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    url = table.Column<string>(type: "text", nullable: false),
                    importer_type = table.Column<string>(type: "text", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    config = table.Column<string>(type: "text", nullable: true),
                    schedule = table.Column<string>(type: "text", nullable: true),
                    last_imported_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sources", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "docs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    url = table.Column<string>(type: "text", nullable: false),
                    title = table.Column<string>(type: "text", nullable: true),
                    content_md = table.Column<string>(type: "text", nullable: true),
                    content_hash = table.Column<string>(type: "text", nullable: true),
                    indexed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_docs", x => x.id);
                    table.ForeignKey(
                        name: "FK_docs_sources_source_id",
                        column: x => x.source_id,
                        principalTable: "sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "jobs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    finished_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_jobs", x => x.id);
                    table.ForeignKey(
                        name: "FK_jobs_sources_source_id",
                        column: x => x.source_id,
                        principalTable: "sources",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "chunks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    doc_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    heading = table.Column<string>(type: "text", nullable: true),
                    heading_path = table.Column<string[]>(type: "text[]", nullable: true),
                    chunk_index = table.Column<int>(type: "integer", nullable: false),
                    token_count = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chunks", x => x.id);
                    table.ForeignKey(
                        name: "FK_chunks_docs_doc_id",
                        column: x => x.doc_id,
                        principalTable: "docs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "embeddings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    chunk_id = table.Column<Guid>(type: "uuid", nullable: false),
                    model = table.Column<string>(type: "text", nullable: false),
                    dimensions = table.Column<int>(type: "integer", nullable: false),
                    vector = table.Column<Vector>(type: "vector", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_embeddings", x => x.id);
                    table.ForeignKey(
                        name: "FK_embeddings_chunks_chunk_id",
                        column: x => x.chunk_id,
                        principalTable: "chunks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_chunks_doc_id",
                table: "chunks",
                column: "doc_id");

            migrationBuilder.CreateIndex(
                name: "IX_chunks_source_id",
                table: "chunks",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "IX_docs_source_id_url",
                table: "docs",
                columns: new[] { "source_id", "url" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_embeddings_chunk_id_model",
                table: "embeddings",
                columns: new[] { "chunk_id", "model" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_import_job_states_job_id",
                table: "import_job_states",
                column: "job_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_jobs_source_id",
                table: "jobs",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "IX_jobs_status",
                table: "jobs",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_sources_url",
                table: "sources",
                column: "url",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "embeddings");

            migrationBuilder.DropTable(
                name: "import_job_states");

            migrationBuilder.DropTable(
                name: "jobs");

            migrationBuilder.DropTable(
                name: "chunks");

            migrationBuilder.DropTable(
                name: "docs");

            migrationBuilder.DropTable(
                name: "sources");
        }
    }
}
