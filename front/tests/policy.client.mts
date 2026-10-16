import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseSnapshot } from "../src/features/restaurant-runtime/snapshotPolicy.ts";
import {
  decodeSnapshot,
  decodeMemberships,
  productsDraftSchema,
} from "../src/shared/api/schemas.ts";
import { sessionFromToken } from "../src/shared/lib/token.ts";
import { watchSessionExpiry } from "../src/shared/lib/sessionExpiry.ts";
import type { Snapshot } from "../src/shared/types/models.ts";
const sample = (
  restaurantId = "r1",
  revision = 5,
  generatedAt = "2026-10-13T12:00:00Z",
): Snapshot => ({
  restaurantId,
  revision,
  generatedAt,
  batches: [],
  supplies: [],
  expiryApprovals: [],
  catalog: [],
  menu: [],
  stopList: [],
  recommendations: [],
  procurement: [],
  recentOrders: [],
  orderHistory: [],
  metrics: {
    productTypes: 0,
    expiringBatches: 0,
    expiredBatches: 0,
    stoppedDishes: 0,
    pendingSupplies: 0,
    completedOrders: 0,
  },
});
test("late HTTP/socket snapshots never replace a newer version or another restaurant", () => {
  const current = sample();
  assert.equal(chooseSnapshot(current, sample("r2", 100), "r1"), current);
  assert.equal(chooseSnapshot(current, sample("r1", 4), "r1"), current);
  assert.equal(
    chooseSnapshot(current, sample("r1", 5, "2026-10-13T11:59:00Z"), "r1"),
    current,
  );
  const latest = sample("r1", 6);
  assert.equal(chooseSnapshot(current, latest, "r1"), latest);
  assert.equal(chooseSnapshot(null, sample("r2"), "r1"), null);
});
test("decoders accept PascalCase but reject incomplete and malformed critical state", () => {
  assert.deepEqual(decodeSnapshot(sample()), sample());
  assert.equal(
    decodeMemberships([{ RestaurantId: "r", Name: "R", Role: 2 }])[0].role,
    "manager",
  );
  assert.throws(
    () => decodeSnapshot({ ...sample(), batches: undefined }),
    /формату/,
  );
  assert.throws(
    () => decodeSnapshot({ ...sample(), catalog: undefined }),
    /формату/,
  );
  assert.throws(
    () => decodeSnapshot({ ...sample(), metrics: { completedOrders: 0 } }),
    /формату/,
  );
  assert.throws(
    () => decodeSnapshot({ ...sample(), generatedAt: "invalid" }),
    /формату/,
  );
  assert.throws(
    () => decodeMemberships([{ restaurantId: "r", name: "R", role: "root" }]),
    /формату/,
  );
});
test("JWT metadata parsing rejects the old fake token and mismatching identity", () => {
  const token = (claims: object) =>
    "e30." +
    Buffer.from(JSON.stringify(claims)).toString("base64url") +
    ".signature";
  const good = token({ UserId: "id", Email: "test@demo.test", exp: 1000 });
  assert.equal(sessionFromToken(good, "mock").expiresAt, 1000000);
  assert.throws(() => sessionFromToken("mock-access-token-123", "mock"), /JWT/);
  assert.throws(
    () =>
      sessionFromToken(good, "live", { id: "other", email: "test@demo.test" }),
    /JWT/,
  );
});
test("catalog validation rejects duplicates and invalid shelf life, while legacy JSON remains valid", () => {
  assert.deepEqual(
    productsDraftSchema.parse([{ name: " Томаты ", shelfLifeDays: 5 }]),
    [{ name: "Томаты", shelfLifeSeconds: 432000 }],
  );
  assert.equal(
    productsDraftSchema.safeParse([
      { name: "Томаты", shelfLifeDays: 5 },
      { name: "томаты", shelfLifeDays: 7 },
    ]).success,
    false,
  );
  assert.equal(
    productsDraftSchema.safeParse([{ name: "Молоко", shelfLifeDays: 0 }])
      .success,
    false,
  );
  assert.deepEqual(
    productsDraftSchema.parse([{ name: "Мука", shelfLifeDays: 1, unit: "kg" }]),
    [{ name: "Мука", shelfLifeSeconds: 86400, unit: "kg" }],
  );
});

test("TokenGenerator.cs claims work with a 30-day lifetime and without session or restaurant-role claims", () => {
  const expiresAt = Date.UTC(2026, 10, 13, 12, 0, 0);
  const claims = {
    UserId: "11111111-1111-4111-8111-111111111111",
    Email: "owner@demo.test",
    iss: "restaurant-backend",
    aud: "restaurant-client",
    exp: expiresAt / 1000,
  };
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "metadata-only-test-signature",
  ].join(".");
  assert.deepEqual(sessionFromToken(token, "live"), {
    accessToken: token,
    user: { id: claims.UserId, email: claims.Email },
    expiresAt,
    dataMode: "live",
  });
});

function fakeExpiryClock() {
  let now = 0;
  const pending = new Map<() => void, number>();
  return {
    now: () => now,
    pending,
    schedule: (callback: () => void, delay: number) => {
      pending.set(callback, delay);
      return () => {
        pending.delete(callback);
      };
    },
    next: () => {
      const [callback, delay] = pending.entries().next().value!;
      pending.delete(callback);
      now += delay;
      callback();
    },
  };
}

test("30-day JWT expiry is scheduled in safe chunks and never logs out before exp", () => {
  const clock = fakeExpiryClock();
  const lifetime = 30 * 24 * 60 * 60 * 1000;
  let expired = 0;
  watchSessionExpiry(
    lifetime,
    () => {
      expired++;
    },
    clock,
  );
  assert.equal([...clock.pending.values()][0], 2_147_483_647);
  clock.next();
  assert.equal(expired, 0);
  assert.equal([...clock.pending.values()][0], lifetime - clock.now());
  clock.next();
  assert.equal(clock.now(), lifetime);
  assert.equal(expired, 1);
  assert.equal(clock.pending.size, 0);
});

test("cancelling an old expiry watcher cannot log out a new session; expired sessions end immediately", () => {
  const clock = fakeExpiryClock();
  let expired = 0;
  const cancel = watchSessionExpiry(
    1000,
    () => {
      expired++;
    },
    clock,
  );
  const staleCallback = [...clock.pending.keys()][0];
  cancel();
  assert.equal(clock.pending.size, 0);
  staleCallback();
  assert.equal(expired, 0);
  watchSessionExpiry(
    0,
    () => {
      expired++;
    },
    clock,
  );
  assert.equal(expired, 1);
  assert.equal(clock.pending.size, 0);
});

test("expiry approval history validates identity, quantity and timestamp; legacy snapshots have an empty history", () => {
  const approval = {
    approvalId: "a",
    batchId: "b",
    supplyId: "s",
    supplyNumber: "12",
    productId: "p",
    productName: "Томаты",
    quantity: 3,
    expiresAt: "2026-10-12T12:00:00Z",
    approvedAt: "2026-10-13T12:00:00Z",
    approvedBy: "manager",
  };
  const decoded = decodeSnapshot({ ...sample(), expiryApprovals: [approval] });
  assert.equal(decoded.expiryApprovals[0].supplyNumber, "12");
  assert.deepEqual(
    decodeSnapshot({ ...sample(), expiryApprovals: undefined }).expiryApprovals,
    [],
  );
  assert.throws(
    () =>
      decodeSnapshot({
        ...sample(),
        expiryApprovals: [{ ...approval, quantity: -1 }],
      }),
    /формату/,
  );
  assert.throws(
    () =>
      decodeSnapshot({
        ...sample(),
        expiryApprovals: [{ ...approval, approvedBy: undefined }],
      }),
    /формату/,
  );
});

test("units belong to products; legacy catalog days are adapted and duplicate unit metadata is ignored elsewhere", () => {
  const value = {
    ...sample(),
    catalog: [
      { productId: "p", name: "Томаты", shelfLifeSeconds: 432000, unit: "pcs" },
    ],
    batches: [
      {
        batchId: "b",
        supplyId: "s",
        productId: "p",
        productName: "Томаты",
        quantity: 3,
        receivedAt: "2026-10-10T12:00:00Z",
        expiresAt: "2026-10-20T12:00:00Z",
        expiryStatus: "fresh",
        remainingHours: 120,
      },
    ],
    supplies: [
      {
        supplyId: "s",
        restaurantId: "r1",
        supplyNumber: "1",
        createdAt: "2026-10-10T12:00:00Z",
        status: "accepted",
        items: [
          {
            productId: "p",
            productName: "Томаты",
            quantity: 3,
            expiresAt: "2026-10-20T12:00:00Z",
          },
        ],
      },
    ],
    stopList: [
      {
        dishId: "d",
        name: "Салат",
        shortages: [
          {
            productId: "p",
            productName: "Томаты",
            required: 4,
            available: 3,
            expired: 0,
          },
        ],
      },
    ],
    procurement: [
      {
        productId: "p",
        productName: "Томаты",
        available: 3,
        target: 4,
        suggested: 1,
      },
    ],
  };
  assert.deepEqual(decodeSnapshot(value), value);
  const legacy = structuredClone(value);
  for (const list of [
    legacy.catalog,
    legacy.batches,
    legacy.supplies[0].items,
    legacy.stopList[0].shortages,
    legacy.procurement,
  ])
    for (const item of list) Object.assign(item, { unit: "pcs" });
  assert.deepEqual(decodeSnapshot(legacy), value);
  const decoded = decodeSnapshot(legacy);
  assert.equal(decoded.catalog[0].unit, "pcs");
  assert.ok(!JSON.stringify(decoded.batches).includes('"unit"'));
  const old = {
    ...value,
    catalog: [{ productId: "p", name: "Томаты", shelfLifeDays: 5 }],
  };
  assert.deepEqual(decodeSnapshot(old).catalog[0], {
    productId: "p",
    name: "Томаты",
    shelfLifeSeconds: 432000,
    unit: "шт.",
  });
});
