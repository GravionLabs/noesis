using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Gravion.Noesis.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddImportJobState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "import_job_states",
                columns: table => new
                {
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    importer_type = table.Column<string>(type: "text", nullable: false),
                    current_state = table.Column<string>(type: "text", nullable: true),
                    doc_count = table.Column<int>(type: "integer", nullable: false),
                    chunk_count = table.Column<int>(type: "integer", nullable: false),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_job_states", x => x.correlation_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_import_job_states_job_id",
                table: "import_job_states",
                column: "job_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "import_job_states");
        }
    }
}
