using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace back.Migrations
{
    /// <inheritdoc />
    public partial class ProdDaysToSecs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ShelfLifeDays",
                table: "Products",
                newName: "ShelfLifeSeconds");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ShelfLifeSeconds",
                table: "Products",
                newName: "ShelfLifeDays");
        }
    }
}
