import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMenuFile,
  stringifyMenuFile,
} from "../src/shared/lib/menuFile.ts";
import { decodeMenu, menuDraftSchema } from "../src/shared/api/schemas.ts";
import type { DishDraft, Product } from "../src/shared/types/models.ts";

const catalog: Product[] = [
  {
    productId: "tomato",
    name: "Томаты",
    shelfLifeSeconds: 432000,
    unit: "шт.",
  },
  { productId: "flour", name: "Мука", shelfLifeSeconds: 7776000, unit: "г" },
];
const existing: DishDraft[] = [
  {
    dishId: "salad",
    name: "Салат",
    recipe: [{ productId: "tomato", quantity: 2 }],
  },
];

test("portable menu JSON resolves catalog names, keeps matching dish IDs and exports every recipe with decimal quantities", () => {
  const parsed = parseMenuFile(
    '{" салат ":{" томаты ":1.5},"Лепёшка":{"Мука":125.125,"Томаты":0.5}}',
    catalog,
    existing,
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].dishId, "salad");
  assert.equal(parsed[0].name, "салат");
  assert.equal(parsed[1].dishId, undefined);
  assert.deepEqual(JSON.parse(stringifyMenuFile(parsed, catalog)), {
    салат: { Томаты: 1.5 },
    Лепёшка: { Мука: 125.125, Томаты: 0.5 },
  });
  assert.deepEqual(
    parseMenuFile(stringifyMenuFile(parsed, catalog), catalog, parsed),
    parsed,
  );
  assert.deepEqual(parseMenuFile("{}", []), []);
  assert.equal(stringifyMenuFile([], []), "{}\n");
});

test("malformed menu files cannot introduce unknown ingredients, repeated names, empty recipes or invalid amounts", () => {
  for (const file of [
    "{broken",
    "[]",
    "null",
    '{"Салат":[]}',
    '{"Салат":{}}',
    '{"Салат":{"Картофель":1}}',
    '{"Салат":{"Томаты":1}," салат ":{"Томаты":2}}',
    '{"Салат":{"Томаты":1," томаты ":2}}',
    ...[0, -1, 0.0001, 1e10, "1", null].map((quantity) =>
      JSON.stringify({ Салат: { Томаты: quantity } }),
    ),
  ])
    assert.throws(() => parseMenuFile(file, catalog));
  assert.throws(() =>
    stringifyMenuFile([{ ...existing[0], recipe: [] }], catalog),
  );
  assert.throws(() =>
    menuDraftSchema.parse([
      existing[0],
      { ...existing[0], name: "Другое блюдо" },
    ]),
  );
});

test("menu export escapes names safely and refuses missing or ambiguously named catalog products", () => {
  const specialCatalog = [{ ...catalog[0], name: "__proto__" }];
  const specialDish = { ...existing[0], name: 'Салат "фирменный"' };
  const json = stringifyMenuFile([specialDish], specialCatalog);
  assert.equal(JSON.parse(json)[specialDish.name].__proto__, 2);
  assert.deepEqual(parseMenuFile(json, specialCatalog, [specialDish]), [
    specialDish,
  ]);
  assert.throws(() => stringifyMenuFile(existing, []), /отсутствует/);
  const ambiguous = [
    ...catalog,
    { ...catalog[0], productId: "other", name: " томаты " },
  ];
  assert.throws(
    () => parseMenuFile('{"Салат":{"Томаты":1}}', ambiguous),
    /повторяется/,
  );
  assert.throws(() => stringifyMenuFile(existing, ambiguous), /повторяется/);
});

test("saved menu responses require stable dish IDs and a nonnegative integer version", () => {
  const document = {
    RestaurantId: "restaurant",
    Version: 2,
    Dishes: [
      {
        DishId: "salad",
        Name: "Салат",
        Recipe: [{ ProductId: "tomato", Quantity: 1 }],
      },
    ],
  };
  assert.equal(decodeMenu(document).dishes[0].dishId, "salad");
  for (const value of [
    { ...document, Version: undefined },
    { ...document, Version: -1 },
    {
      ...document,
      Dishes: [
        { Name: "Без ID", Recipe: [{ ProductId: "tomato", Quantity: 1 }] },
      ],
    },
    {
      ...document,
      Dishes: [{ DishId: "dish", Name: "Без рецепта", Recipe: [] }],
    },
  ])
    assert.throws(() => decodeMenu(value), /формату/);
});
