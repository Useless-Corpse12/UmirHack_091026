import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateWarehouse } from "../src/shared/lib/warehouse.ts";
import {
  durationSeconds,
  splitDuration,
  durationLabel,
  MAX_SHELF_LIFE_SECONDS,
} from "../src/shared/lib/shelfLife.ts";
import {
  productsDraftSchema,
  decodeProducts,
} from "../src/shared/api/schemas.ts";
import type { Batch, Product } from "../src/shared/types/models.ts";
import { unitLabel } from "../src/shared/lib/format.ts";

const catalog: Product[] = [
  { productId: "p", name: "Томаты", shelfLifeSeconds: 3661, unit: "кг" },
  {
    productId: "zero",
    name: "Пустой продукт",
    shelfLifeSeconds: 60,
    unit: "шт.",
  },
];
const batch = (
  id: string,
  quantity: number,
  expiresAt: string,
  expiryStatus: Batch["expiryStatus"] = "fresh",
): Batch => ({
  batchId: id,
  supplyId: id,
  productId: "p",
  productName: "Старое имя",
  quantity,
  expiresAt,
  expiryStatus,
  receivedAt: "2026-10-10T00:00:00Z",
  remainingHours: 1,
});

test("product stock separates expired goods, sums equal expiry instants, and keeps catalog names and units", () => {
  const rows = aggregateWarehouse(
    [
      batch("later", 2, "2026-10-20T10:00:00Z"),
      batch("expired", 3, "2026-10-11T10:00:00Z", "expired"),
      batch("first", 0.1, "2026-10-16T10:00:00Z", "soon"),
      batch("same-instant", 0.2, "2026-10-16T13:00:00+03:00", "soon"),
      batch("empty", 0, "2026-10-15T10:00:00Z"),
    ],
    catalog,
  );
  const row = rows.find((p) => p.productId === "p")!;
  assert.deepEqual(row, {
    productId: "p",
    productName: "Томаты",
    unit: "кг",
    totalQuantity: 5.3,
    availableQuantity: 2.3,
    expiredQuantity: 3,
    nextExpiresAt: "2026-10-16T10:00:00Z",
    nextExpiryQuantity: 0.3,
    batchCount: 4,
  });
  assert.equal(rows.find((p) => p.productId === "zero")!.totalQuantity, 0);
});

test("products with the same name never merge; expired-only and empty stock have no upcoming expiry", () => {
  const rows = aggregateWarehouse(
    [
      batch("expired", 2, "2026-10-11T10:00:00Z", "expired"),
      {
        ...batch("unknown", 1, "2026-10-19T10:00:00Z"),
        productId: "unknown",
        productName: "Томаты",
      },
    ],
    catalog,
  );
  assert.equal(rows.length, 3);
  assert.equal(rows.find((p) => p.productId === "p")!.nextExpiresAt, null);
  assert.equal(rows.find((p) => p.productId === "p")!.nextExpiryQuantity, 0);
  assert.equal(
    rows.find((p) => p.productId === "unknown")!.availableQuantity,
    1,
  );
  assert.equal(rows.find((p) => p.productId === "unknown")!.unit, "");
  assert.equal(aggregateWarehouse([], catalog)[0].nextExpiresAt, null);
  assert.deepEqual(aggregateWarehouse([], []), []);
});

test("duration editor round-trips seconds without rounding sub-day or mixed durations", () => {
  for (const seconds of [
    1,
    59,
    60,
    3661,
    86400,
    2 * 86400 + 3 * 3600 + 4 * 60 + 5,
    MAX_SHELF_LIFE_SECONDS,
  ])
    assert.equal(durationSeconds(splitDuration(seconds)), seconds);
  assert.equal(
    durationLabel(2 * 86400 + 3 * 3600 + 4 * 60 + 5),
    "2 дн. 3 ч. 4 мин. 5 сек.",
  );
  assert.equal(durationLabel(1), "1 сек.");
  for (const parts of [
    { days: 0, hours: 0, minutes: 0, seconds: 0 },
    { days: -1, hours: 0, minutes: 0, seconds: 1 },
    { days: 0, hours: 24, minutes: 0, seconds: 0 },
    { days: 0, hours: 0, minutes: 60, seconds: 0 },
    { days: 0, hours: 0, minutes: 0, seconds: 1.5 },
    { days: 3650, hours: 0, minutes: 0, seconds: 1 },
  ])
    assert.throws(() => durationSeconds(parts));
});

test("catalog import accepts old days, sends seconds, keeps optional unit omissions, and rejects ambiguous durations", () => {
  assert.equal(unitLabel("pcs"), "шт.");
  assert.equal(unitLabel("ящик"), "ящик");
  assert.equal(unitLabel("toString"), "toString");
  assert.equal(unitLabel("__proto__"), "__proto__");
  assert.deepEqual(
    productsDraftSchema.parse([{ name: " Старый ", shelfLifeDays: 7 }]),
    [{ name: "Старый", shelfLifeSeconds: 604800 }],
  );
  assert.deepEqual(
    decodeProducts([
      { ProductId: "p", Name: "Новый", ShelfLifeSeconds: 61, Unit: " кг " },
    ]),
    [{ productId: "p", name: "Новый", shelfLifeSeconds: 61, unit: "кг" }],
  );
  for (const value of [
    { shelfLifeSeconds: 0 },
    { shelfLifeSeconds: -1 },
    { shelfLifeSeconds: 1.5 },
    { shelfLifeSeconds: MAX_SHELF_LIFE_SECONDS + 1 },
    { shelfLifeSeconds: "60" },
    { shelfLifeSeconds: 60, shelfLifeDays: 1 },
    { shelfLifeDays: 0.5 },
    {},
    { shelfLifeSeconds: 60, unit: " " },
    { shelfLifeSeconds: 60, unit: "x".repeat(21) },
  ])
    assert.equal(
      productsDraftSchema.safeParse([{ name: "Продукт", ...value }]).success,
      false,
    );
});
