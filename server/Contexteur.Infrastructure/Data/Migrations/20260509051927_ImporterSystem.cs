using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Contexteur.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ImporterSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "type",
                table: "sources",
                newName: "importer_type");

            migrationBuilder.AddColumn<string>(
                name: "config",
                table: "sources",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_imported_at",
                table: "sources",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "schedule",
                table: "sources",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "config",
                table: "sources");

            migrationBuilder.DropColumn(
                name: "last_imported_at",
                table: "sources");

            migrationBuilder.DropColumn(
                name: "schedule",
                table: "sources");

            migrationBuilder.RenameColumn(
                name: "importer_type",
                table: "sources",
                newName: "type");
        }
    }
}
