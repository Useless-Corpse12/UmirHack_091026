import test from "node:test";
import assert from "node:assert/strict";
import { mergeProductCatalog, stringifyProductsFile } from "../src/shared/lib/productsFile.ts";

test("export uses actual products, not example milk/tomato/flour entries", () => {
  const products = [
    { productId: "product-101", name: "Гречка", shelfLifeSeconds: 12345, unit: "кг" },
    { productId: "product-202", name: "Шпинат", shelfLifeSeconds: 3600, unit: "г", reorderLevel: 4 },
  ];
  const output = JSON.parse(stringifyProductsFile(products));
  assert.deepEqual(output, [
    { productId: "product-101", name: "Гречка", shelfLifeSeconds: 12345, unit: "кг" },
    { productId: "product-202", name: "Шпинат", shelfLifeSeconds: 3600, unit: "г" },
  ]);
  assert.ok(!stringifyProductsFile(products).includes("Молоко"));
});

test("empty real catalog exports an empty array, not fake sample products", () => {
  assert.equal(stringifyProductsFile([]), "[]");
});

test("export serializes modified name, unit and duration", () => {
  const product = { productId: "product-101", name: "Овсяное молоко", shelfLifeSeconds: 9400, unit: "мл" };
  assert.deepEqual(JSON.parse(stringifyProductsFile([product]))[0], product);
});

test("single product update does not discard other products on full-replacement API", () => {
  const current = [
    { productId: "id-a", name: "Гречка", shelfLifeSeconds: 300, unit: "кг" },
    { productId: "id-b", name: "Мука", shelfLifeSeconds: 1000, unit: "г" },
  ];
  assert.deepEqual(mergeProductCatalog(current, {
    productId: "id-a", name: "Гречка (новая)", shelfLifeSeconds: 600, unit: "кг",
  }, "id-a"), [
    { productId: "id-a", name: "Гречка (новая)", shelfLifeSeconds: 600, unit: "кг" },
    current[1],
  ]);
  assert.deepEqual(mergeProductCatalog(current, {
    name: "Хлебцы", shelfLifeSeconds: 86400, unit: "уп.",
  }, null).map(item => item.name), ["Гречка", "Мука", "Хлебцы"]);
  assert.throws(() => mergeProductCatalog(current, { name: "X", shelfLifeSeconds: 600, unit: "шт." }, "missing"), /другом окне/);
});
