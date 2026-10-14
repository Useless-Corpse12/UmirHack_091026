using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace back.Migrations
{
    /// <inheritdoc />
    public partial class BigFixes1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Dishes_Orders_OrderId",
                table: "Dishes");

            migrationBuilder.DropForeignKey(
                name: "FK_DishIngredientLink_Dishes_DishId",
                table: "DishIngredientLink");

            migrationBuilder.DropForeignKey(
                name: "FK_OrderItem_Orders_OrderId",
                table: "OrderItem");

            migrationBuilder.DropForeignKey(
                name: "FK_SupplyItems_Supplies_SupplyId",
                table: "SupplyItems");

            migrationBuilder.DropIndex(
                name: "IX_Dishes_OrderId",
                table: "Dishes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_OrderItem",
                table: "OrderItem");

            migrationBuilder.DropPrimaryKey(
                name: "PK_DishIngredientLink",
                table: "DishIngredientLink");

            migrationBuilder.DropColumn(
                name: "Id",
                table: "UserRestaurants");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "OrderId",
                table: "Dishes");

            migrationBuilder.DropColumn(
                name: "Quanity",
                table: "DishIngredientLink");

            migrationBuilder.RenameTable(
                name: "OrderItem",
                newName: "OrderItems");

            migrationBuilder.RenameTable(
                name: "DishIngredientLink",
                newName: "DishIngredientLinks");

            migrationBuilder.RenameIndex(
                name: "IX_OrderItem_OrderId",
                table: "OrderItems",
                newName: "IX_OrderItems_OrderId");

            migrationBuilder.RenameIndex(
                name: "IX_DishIngredientLink_DishId",
                table: "DishIngredientLinks",
                newName: "IX_DishIngredientLinks_DishId");

            migrationBuilder.AlterColumn<Guid>(
                name: "SupplyId",
                table: "SupplyItems",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Quantity",
                table: "SupplyItems",
                type: "integer",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAt",
                table: "SupplyItems",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AlterColumn<int>(
                name: "Quantity",
                table: "RotRecords",
                type: "integer",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AddColumn<int>(
                name: "ShelfLifeDays",
                table: "Products",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrderId",
                table: "OrderItems",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "DishId",
                table: "DishIngredientLinks",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "DishIngredientLinks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddPrimaryKey(
                name: "PK_OrderItems",
                table: "OrderItems",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_DishIngredientLinks",
                table: "DishIngredientLinks",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "OrderDishes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    DishId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderDishes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderDishes_Dishes_DishId",
                        column: x => x.DishId,
                        principalTable: "Dishes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderDishes_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserRestaurants_RestaurantId",
                table: "UserRestaurants",
                column: "RestaurantId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRestaurants_UserId_RestaurantId",
                table: "UserRestaurants",
                columns: new[] { "UserId", "RestaurantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupplyItems_ProductId",
                table: "SupplyItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Supplies_RestaurantId",
                table: "Supplies",
                column: "RestaurantId");

            migrationBuilder.CreateIndex(
                name: "IX_RotRecords_ProductId",
                table: "RotRecords",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_RotRecords_RestaurantId",
                table: "RotRecords",
                column: "RestaurantId");

            migrationBuilder.CreateIndex(
                name: "IX_RotRecords_SupplyItemId",
                table: "RotRecords",
                column: "SupplyItemId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_RestaurantId",
                table: "Products",
                column: "RestaurantId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_RestaurantId",
                table: "Orders",
                column: "RestaurantId");

            migrationBuilder.CreateIndex(
                name: "IX_Dishes_RestaurantId",
                table: "Dishes",
                column: "RestaurantId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_ProductId",
                table: "OrderItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_SupplyId",
                table: "OrderItems",
                column: "SupplyId");

            migrationBuilder.CreateIndex(
                name: "IX_DishIngredientLinks_ProductId",
                table: "DishIngredientLinks",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderDishes_DishId",
                table: "OrderDishes",
                column: "DishId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderDishes_OrderId",
                table: "OrderDishes",
                column: "OrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_Dishes_Restaurants_RestaurantId",
                table: "Dishes",
                column: "RestaurantId",
                principalTable: "Restaurants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DishIngredientLinks_Dishes_DishId",
                table: "DishIngredientLinks",
                column: "DishId",
                principalTable: "Dishes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DishIngredientLinks_Products_ProductId",
                table: "DishIngredientLinks",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Orders_OrderId",
                table: "OrderItems",
                column: "OrderId",
                principalTable: "Orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Products_ProductId",
                table: "OrderItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Supplies_SupplyId",
                table: "OrderItems",
                column: "SupplyId",
                principalTable: "Supplies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_Restaurants_RestaurantId",
                table: "Orders",
                column: "RestaurantId",
                principalTable: "Restaurants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Restaurants_RestaurantId",
                table: "Products",
                column: "RestaurantId",
                principalTable: "Restaurants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RotRecords_Products_ProductId",
                table: "RotRecords",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RotRecords_Restaurants_RestaurantId",
                table: "RotRecords",
                column: "RestaurantId",
                principalTable: "Restaurants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RotRecords_SupplyItems_SupplyItemId",
                table: "RotRecords",
                column: "SupplyItemId",
                principalTable: "SupplyItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Supplies_Restaurants_RestaurantId",
                table: "Supplies",
                column: "RestaurantId",
                principalTable: "Restaurants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SupplyItems_Products_ProductId",
                table: "SupplyItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SupplyItems_Supplies_SupplyId",
                table: "SupplyItems",
                column: "SupplyId",
                principalTable: "Supplies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserRestaurants_Restaurants_RestaurantId",
                table: "UserRestaurants",
                column: "RestaurantId",
                principalTable: "Restaurants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserRestaurants_Users_UserId",
                table: "UserRestaurants",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Dishes_Restaurants_RestaurantId",
                table: "Dishes");

            migrationBuilder.DropForeignKey(
                name: "FK_DishIngredientLinks_Dishes_DishId",
                table: "DishIngredientLinks");

            migrationBuilder.DropForeignKey(
                name: "FK_DishIngredientLinks_Products_ProductId",
                table: "DishIngredientLinks");

            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_Orders_OrderId",
                table: "OrderItems");

            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_Products_ProductId",
                table: "OrderItems");

            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_Supplies_SupplyId",
                table: "OrderItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Orders_Restaurants_RestaurantId",
                table: "Orders");

            migrationBuilder.DropForeignKey(
                name: "FK_Products_Restaurants_RestaurantId",
                table: "Products");

            migrationBuilder.DropForeignKey(
                name: "FK_RotRecords_Products_ProductId",
                table: "RotRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_RotRecords_Restaurants_RestaurantId",
                table: "RotRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_RotRecords_SupplyItems_SupplyItemId",
                table: "RotRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_Supplies_Restaurants_RestaurantId",
                table: "Supplies");

            migrationBuilder.DropForeignKey(
                name: "FK_SupplyItems_Products_ProductId",
                table: "SupplyItems");

            migrationBuilder.DropForeignKey(
                name: "FK_SupplyItems_Supplies_SupplyId",
                table: "SupplyItems");

            migrationBuilder.DropForeignKey(
                name: "FK_UserRestaurants_Restaurants_RestaurantId",
                table: "UserRestaurants");

            migrationBuilder.DropForeignKey(
                name: "FK_UserRestaurants_Users_UserId",
                table: "UserRestaurants");

            migrationBuilder.DropTable(
                name: "OrderDishes");

            migrationBuilder.DropIndex(
                name: "IX_UserRestaurants_RestaurantId",
                table: "UserRestaurants");

            migrationBuilder.DropIndex(
                name: "IX_UserRestaurants_UserId_RestaurantId",
                table: "UserRestaurants");

            migrationBuilder.DropIndex(
                name: "IX_SupplyItems_ProductId",
                table: "SupplyItems");

            migrationBuilder.DropIndex(
                name: "IX_Supplies_RestaurantId",
                table: "Supplies");

            migrationBuilder.DropIndex(
                name: "IX_RotRecords_ProductId",
                table: "RotRecords");

            migrationBuilder.DropIndex(
                name: "IX_RotRecords_RestaurantId",
                table: "RotRecords");

            migrationBuilder.DropIndex(
                name: "IX_RotRecords_SupplyItemId",
                table: "RotRecords");

            migrationBuilder.DropIndex(
                name: "IX_Products_RestaurantId",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Orders_RestaurantId",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Dishes_RestaurantId",
                table: "Dishes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_OrderItems",
                table: "OrderItems");

            migrationBuilder.DropIndex(
                name: "IX_OrderItems_ProductId",
                table: "OrderItems");

            migrationBuilder.DropIndex(
                name: "IX_OrderItems_SupplyId",
                table: "OrderItems");

            migrationBuilder.DropPrimaryKey(
                name: "PK_DishIngredientLinks",
                table: "DishIngredientLinks");

            migrationBuilder.DropIndex(
                name: "IX_DishIngredientLinks_ProductId",
                table: "DishIngredientLinks");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "SupplyItems");

            migrationBuilder.DropColumn(
                name: "ShelfLifeDays",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Quantity",
                table: "DishIngredientLinks");

            migrationBuilder.RenameTable(
                name: "OrderItems",
                newName: "OrderItem");

            migrationBuilder.RenameTable(
                name: "DishIngredientLinks",
                newName: "DishIngredientLink");

            migrationBuilder.RenameIndex(
                name: "IX_OrderItems_OrderId",
                table: "OrderItem",
                newName: "IX_OrderItem_OrderId");

            migrationBuilder.RenameIndex(
                name: "IX_DishIngredientLinks_DishId",
                table: "DishIngredientLink",
                newName: "IX_DishIngredientLink_DishId");

            migrationBuilder.AddColumn<Guid>(
                name: "Id",
                table: "UserRestaurants",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<Guid>(
                name: "SupplyId",
                table: "SupplyItems",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "SupplyItems",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "RotRecords",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAt",
                table: "Products",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<Guid>(
                name: "OrderId",
                table: "Dishes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrderId",
                table: "OrderItem",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<Guid>(
                name: "DishId",
                table: "DishIngredientLink",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<decimal>(
                name: "Quanity",
                table: "DishIngredientLink",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddPrimaryKey(
                name: "PK_OrderItem",
                table: "OrderItem",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_DishIngredientLink",
                table: "DishIngredientLink",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_Dishes_OrderId",
                table: "Dishes",
                column: "OrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_Dishes_Orders_OrderId",
                table: "Dishes",
                column: "OrderId",
                principalTable: "Orders",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DishIngredientLink_Dishes_DishId",
                table: "DishIngredientLink",
                column: "DishId",
                principalTable: "Dishes",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItem_Orders_OrderId",
                table: "OrderItem",
                column: "OrderId",
                principalTable: "Orders",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SupplyItems_Supplies_SupplyId",
                table: "SupplyItems",
                column: "SupplyId",
                principalTable: "Supplies",
                principalColumn: "Id");
        }
    }
}
