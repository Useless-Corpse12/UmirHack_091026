import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDemoServer } from "../demo/server.mjs";

const RID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOMATO = "10000000-0000-4000-8000-000000000001";
const CUCUMBER = "10000000-0000-4000-8000-000000000002";
const DISH = "20000000-0000-4000-8000-000000000001";
async function harness(t, options = {}) {
  const app = createDemoServer(options);
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  t.after(() => app.close());
  const base = "http://127.0.0.1:" + app.server.address().port;
  const request = async (
    path,
    { method = "GET", body, headers = {}, actor } = {},
  ) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(actor?.token ? { Authorization: "Bearer " + actor.token } : {}),
        ...(actor?.cookie ? { Cookie: actor.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = res.headers.get("set-cookie");
    if (actor && cookie) actor.cookie = cookie.split(";")[0];
    const raw = await res.text();
    return {
      status: res.status,
      data: raw ? JSON.parse(raw) : null,
      headers: res.headers,
    };
  };
  const login = async (email = "owner@demo.test", password = "Demo123!") => {
    const actor = {};
    const result = await request("/api/Authority/AuthorizeUser", {
      method: "POST",
      body: { email, password },
      actor,
    });
    assert.equal(result.status, 200);
    actor.token = result.data.accessToken;
    actor.user = result.data.user;
    return actor;
  };
  const snap = async (actor, id = RID) => {
    const r = await request("/api/Restaurant/" + id + "/snapshot", { actor });
    assert.equal(r.status, 200);
    return r.data;
  };
  return { app, base, request, login, snap };
}
const usable = (snapshot, id) =>
  snapshot.batches
    .filter((b) => b.productId === id && b.expiryStatus !== "expired")
    .reduce((s, b) => s + b.quantity, 0);
const orderOptions = (actor, key, quantity = 1) => ({
  method: "POST",
  actor,
  headers: { "Idempotency-Key": key },
  body: { items: [{ dishId: DISH, quantity }] },
});
function stream(base, actor, id = RID) {
  const frames = [];
  const waiters = new Set();
  const ws = new WebSocket(
    base.replace("http:", "ws:") +
      "/ws/restaurants?restaurantId=" +
      id +
      "&access_token=" +
      encodeURIComponent(actor.token),
  );
  ws.addEventListener("message", (e) => {
    const frame = JSON.parse(e.data);
    frames.push(frame);
    for (const w of [...waiters]) w(frame);
  });
  ws.addEventListener("error", () => {}); // Expected policy failures are asserted via close.
  const next = (predicate) => {
    const cached = frames.find(predicate);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      const waiter = (frame) => {
        if (predicate(frame)) {
          clearTimeout(timer);
          waiters.delete(waiter);
          resolve(frame);
        }
      };
      const timer = setTimeout(() => {
        waiters.delete(waiter);
        reject(new Error("WebSocket snapshot timeout"));
      }, 4000);
      waiters.add(waiter);
    });
  };
  return { ws, frames, next };
}

test("registration requires the actual code, rejects bad credentials and unverified accounts", async (t) => {
  const h = await harness(t);
  const credentials = { email: "new@demo.test", password: "New123!" };
  const reg = await h.request("/api/Authority/RegisterUser", {
    method: "POST",
    body: credentials,
  });
  assert.equal(reg.status, 200);
  assert.match(reg.data.devVerificationCode, /^\d{6}$/);
  assert.equal(
    (
      await h.request("/api/Authority/AuthorizeUser", {
        method: "POST",
        body: credentials,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/Authority/VerifyUser", {
        method: "POST",
        body: { email: credentials.email, verificationCode: "000000" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await h.request("/api/Authority/VerifyUser", {
        method: "POST",
        body: {
          email: credentials.email,
          verificationCode: reg.data.devVerificationCode,
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await h.request("/api/Authority/AuthorizeUser", {
        method: "POST",
        body: { ...credentials, password: "wrongpw" },
      })
    ).status,
    401,
  );
  const actor = await h.login(credentials.email, credentials.password);
  assert.deepEqual((await h.request("/api/Restaurant/my", { actor })).data, []);
  assert.equal(
    (
      await h.request("/api/Authority/RegisterUser", {
        method: "POST",
        body: credentials,
      })
    ).status,
    409,
  );
  assert.ok(!JSON.stringify(h.app.getState()).includes("New123!"));
});

test("access-only login issues no cookie; expiry requires login and logout revokes only its own access token", async (t) => {
  let clock = Date.now();
  const h = await harness(t, { now: () => clock, accessTtlSeconds: 2 });
  const response = await h.request("/api/Authority/AuthorizeUser", {
    method: "POST",
    body: { email: "owner@demo.test", password: "Demo123!" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(Object.keys(response.data).sort(), ["accessToken", "user"]);
  const actor = { token: response.data.accessToken };
  assert.equal(
    (await h.request("/api/Authority/Refresh", { method: "POST", actor }))
      .status,
    404,
  );
  clock += 3000;
  assert.equal((await h.request("/api/Restaurant/my", { actor })).status, 401);
  const next = await h.login();
  const otherSession = await h.login();
  assert.notEqual(next.token, actor.token);
  assert.equal(
    (await h.request("/api/Authority/Logout", { method: "POST", actor: next }))
      .status,
    200,
  );
  assert.equal(
    (await h.request("/api/Restaurant/my", { actor: next })).status,
    401,
  );
  assert.equal(
    (await h.request("/api/Restaurant/my", { actor: otherSession })).status,
    200,
  );
  assert.ok(
    h.app
      .getState()
      .sessions.every(
        (session) =>
          Object.keys(session).sort().join() === "expiresAt,sid,userId",
      ),
  );
});

test("roles are per restaurant; userId spoofing does not grant owner privileges", async (t) => {
  const h = await harness(t);
  const owner = await h.login();
  const manager = await h.login("manager@demo.test");
  const admin = await h.login("admin@demo.test");
  const list = (await h.request("/api/Restaurant/my", { actor: owner })).data;
  assert.equal(list.find((m) => m.restaurantId === RID).role, "owner");
  assert.equal(list.find((m) => m.restaurantId === OTHER).role, "manager");
  assert.equal(
    (
      await h.request("/api/Restaurant/" + OTHER + "?userId=" + owner.user.id, {
        method: "DELETE",
        actor: owner,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/" + RID + "?userId=" + owner.user.id, {
        method: "DELETE",
        actor: admin,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/" + RID + "/products", {
        method: "PUT",
        actor: manager,
        body: [{ name: "Мука", shelfLifeDays: 1 }],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/CreatePOS", {
        method: "POST",
        actor: manager,
        body: { restaurantId: RID, pincode: "0123" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/" + OTHER + "/snapshot", {
        actor: manager,
      })
    ).status,
    403,
  );
  assert.equal(
    (await h.request("/api/Restaurant/" + RID + "/snapshot")).status,
    401,
  );
});

test("supply stays pending, acceptance adds stock exactly once, rejection never adds stock", async (t) => {
  const h = await harness(t);
  const actor = await h.login();
  const initial = await h.snap(actor);
  const qty = usable(initial, TOMATO);
  const pending = initial.supplies.find((s) => s.status === "pending");
  assert.equal(pending.status, "pending");
  assert.equal(qty, 3);
  const url = "/api/Supply/" + pending.supplyId + "/accept";
  assert.equal(
    (
      await h.request(url, {
        method: "POST",
        actor,
        body: { restaurantId: OTHER },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request(url, {
        method: "POST",
        actor,
        body: { restaurantId: RID },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await h.request(url, {
        method: "POST",
        actor,
        body: { restaurantId: RID },
      })
    ).status,
    200,
  );
  assert.equal(usable(await h.snap(actor), TOMATO), qty + 4);
  assert.equal(
    (
      await h.request("/api/Supply/" + pending.supplyId + "/reject", {
        method: "POST",
        actor,
        body: { restaurantId: RID },
      })
    ).status,
    409,
  );
  const newSupply = await h.request("/api/Demo/" + RID + "/supply", {
    method: "POST",
    actor,
    body: { items: [{ productId: TOMATO, quantity: 0.125 }] },
  });
  assert.equal(newSupply.status, 200);
  assert.equal(usable(await h.snap(actor), TOMATO), qty + 4);
  assert.equal(
    (
      await h.request("/api/Supply/" + newSupply.data.supplyId + "/reject", {
        method: "POST",
        actor,
        body: { restaurantId: RID },
      })
    ).status,
    200,
  );
  assert.equal(usable(await h.snap(actor), TOMATO), qty + 4);
});

test("whole-order validation rolls back shortages and FEFO consumes multiple usable batches", async (t) => {
  const h = await harness(t);
  const actor = await h.login();
  const before = await h.snap(actor);
  const expired = before.batches.find((b) => b.expiryStatus === "expired");
  const bad = await h.request(
    "/api/Demo/" + RID + "/order",
    orderOptions(actor, "bad", 2),
  );
  assert.equal(bad.status, 409);
  assert.equal(bad.data.code, "INSUFFICIENT_STOCK");
  const afterBad = await h.snap(actor);
  assert.deepEqual(
    afterBad.batches.map((b) => [b.batchId, b.quantity]),
    before.batches.map((b) => [b.batchId, b.quantity]),
  );
  assert.equal(afterBad.recentOrders.length, 0);
  const good = await h.request(
    "/api/Demo/" + RID + "/order",
    orderOptions(actor, "good"),
  );
  assert.equal(good.status, 200);
  const after = await h.snap(actor);
  assert.equal(usable(after, TOMATO), 1);
  assert.equal(usable(after, CUCUMBER), 1);
  assert.equal(
    after.batches.find((b) => b.batchId === expired.batchId).quantity,
    expired.quantity,
  );
  assert.equal(after.recentOrders[0].allocations.length, 3);
  const soon = before.batches.find(
    (b) => b.productId === TOMATO && b.expiryStatus === "soon",
  );
  assert.equal(after.recentOrders[0].allocations[0].batchId, soon.batchId);
  assert.equal(after.recentOrders[0].allocations[0].quantity, 1);
  assert.equal(after.stopList.length, 1);
  assert.equal(after.recommendations.length, 0);
});

test("concurrent last-portion orders allow one winner; retries are idempotent", async (t) => {
  const h = await harness(t);
  const actor = await h.login();
  const results = await Promise.all(
    ["one", "two"].map((key) =>
      h.request("/api/Demo/" + RID + "/order", orderOptions(actor, key)),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const index = results.findIndex((r) => r.status === 200);
  const key = ["one", "two"][index];
  const beforeRetry = await h.snap(actor);
  const retry = await h.request(
    "/api/Demo/" + RID + "/order",
    orderOptions(actor, key),
  );
  assert.deepEqual(retry.data, results[index].data);
  assert.equal((await h.snap(actor)).recentOrders.length, 1);
  assert.equal(
    usable(await h.snap(actor), TOMATO),
    usable(beforeRetry, TOMATO),
  );
  assert.equal(
    (
      await h.request(
        "/api/Demo/" + RID + "/order",
        orderOptions(actor, key, 2),
      )
    ).data.code,
    "KEY_REUSED",
  );
});

test("catalog import preserves IDs and units, validates atomically and supplies preserve decimals", async (t) => {
  const h = await harness(t);
  const actor = await h.login();
  const path = "/api/Restaurant/" + RID + "/products";
  const save = await h.request(path, {
    method: "PUT",
    actor,
    body: [
      { productId: TOMATO, name: "Томаты новые", shelfLifeDays: 6 },
      { name: "Мука", shelfLifeDays: 90, unit: "g" },
    ],
  });
  assert.equal(save.status, 200);
  assert.equal(save.data.find((p) => p.productId === TOMATO).unit, "шт.");
  const flour = save.data.find((p) => p.name === "Мука");
  assert.equal(flour.unit, "g");
  assert.equal(flour.shelfLifeSeconds, 90 * 86400);
  const before = (await h.request(path, { actor })).data;
  const bad = await h.request(path, {
    method: "PUT",
    actor,
    body: [
      { name: "Рис", shelfLifeDays: 1 },
      { name: "", shelfLifeDays: 1 },
    ],
  });
  assert.equal(bad.status, 400);
  assert.deepEqual((await h.request(path, { actor })).data, before);
  const collision = await h.request(path, {
    method: "PUT",
    actor,
    body: [{ productId: TOMATO, name: " мука ", shelfLifeDays: 6 }],
  });
  assert.equal(collision.status, 409);
  assert.equal(collision.data.code, "PRODUCT_NAME_EXISTS");
  assert.deepEqual((await h.request(path, { actor })).data, before);
  assert.equal(
    (
      await h.request(path, {
        method: "PUT",
        actor,
        body: [
          {
            productId: TOMATO,
            name: "Томаты новые",
            shelfLifeDays: 6,
            unit: "g",
          },
        ],
      })
    ).status,
    200,
  );
  const supply = await h.request("/api/Demo/" + RID + "/supply", {
    method: "POST",
    actor,
    body: { items: [{ productId: flour.productId, quantity: 123.125 }] },
  });
  assert.equal(supply.status, 200);
  await h.request("/api/Supply/" + supply.data.supplyId + "/accept", {
    method: "POST",
    actor,
    body: { restaurantId: RID },
  });
  assert.equal(usable(await h.snap(actor), flour.productId), 123.125);
});

test("second-based catalog lifetimes drive new supplies exactly, preserve old batch dates, and reject invalid updates atomically", async (t) => {
  let now = Date.UTC(2026, 9, 15, 12);
  const h = await harness(t, { now: () => now });
  const actor = await h.login();
  const path = "/api/Restaurant/" + RID + "/products";
  const before = await h.snap(actor);
  const save = await h.request(path, {
    method: "PUT",
    actor,
    body: [
      { productId: TOMATO, name: "Томаты", shelfLifeSeconds: 61, unit: "ящик" },
      { name: "Быстрый", shelfLifeSeconds: 1, unit: "г" },
    ],
  });
  assert.equal(save.status, 200);
  assert.deepEqual((await h.snap(actor)).batches, before.batches);
  assert.equal(
    save.data.find((p) => p.productId === TOMATO).shelfLifeSeconds,
    61,
  );
  // Old imports omit unit: keep the product's existing label.
  const legacy = await h.request(path, {
    method: "PUT",
    actor,
    body: [{ productId: TOMATO, name: "Томаты", shelfLifeDays: 2 }],
  });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.data.find((p) => p.productId === TOMATO).unit, "ящик");
  const saved = (await h.request(path, { actor })).data;
  for (const fields of [
    { shelfLifeSeconds: 0 },
    { shelfLifeSeconds: 1.5 },
    { shelfLifeSeconds: -1 },
    { shelfLifeSeconds: 3650 * 86400 + 1 },
    { shelfLifeSeconds: "61" },
    { shelfLifeSeconds: 61, shelfLifeDays: 1 },
    { shelfLifeDays: 0.5 },
    {},
    { shelfLifeSeconds: 61, unit: " " },
    { shelfLifeSeconds: 61, unit: null },
  ]) {
    const bad = await h.request(path, {
      method: "PUT",
      actor,
      body: [
        { productId: TOMATO, name: "Временная правка", shelfLifeSeconds: 123 },
        { name: "Неверный", ...fields },
      ],
    });
    assert.equal(bad.status, 400, JSON.stringify(fields));
    assert.deepEqual((await h.request(path, { actor })).data, saved);
  }
  const fast = saved.find((p) => p.name === "Быстрый");
  const supplier = await h.request(
    "/api/Supply/GetProducts?RestaurantId=" + RID + "&ApiKey=demo-supplier-key",
  );
  assert.equal(supplier.status, 200);
  assert.equal(
    supplier.data.find((p) => p.productId === fast.productId).expiresAt,
    new Date(now + 1000).toISOString(),
  );
  const created = await h.request("/api/Demo/" + RID + "/supply", {
    method: "POST",
    actor,
    body: { items: [{ productId: fast.productId, quantity: 0.125 }] },
  });
  assert.equal(created.status, 200);
  const supply = (await h.snap(actor)).supplies.find(
    (s) => s.supplyId === created.data.supplyId,
  );
  assert.equal(supply.items[0].expiresAt, new Date(now + 1000).toISOString());
  assert.equal(supply.items[0].quantity, 0.125);
  assert.ok(!("unit" in supply.items[0]));
  assert.equal(
    (
      await h.request("/api/Supply/" + supply.supplyId + "/accept", {
        method: "POST",
        actor,
        body: { restaurantId: RID },
      })
    ).status,
    200,
  );
  assert.equal(usable(await h.snap(actor), fast.productId), 0.125);
  now += 1000;
  const after = await h.snap(actor);
  assert.equal(usable(after, fast.productId), 0);
  assert.equal(
    after.batches.find((b) => b.productId === fast.productId).expiryStatus,
    "expired",
  );
});

test("invitations bind email and preserve restaurant role; PINs retain leading zeros and remain private", async (t) => {
  const h = await harness(t);
  const owner = await h.login();
  const credentials = { email: "invited@demo.test", password: "Demo123!" };
  const reg = await h.request("/api/Authority/RegisterUser", {
    method: "POST",
    body: credentials,
  });
  await h.request("/api/Authority/VerifyUser", {
    method: "POST",
    body: {
      email: credentials.email,
      verificationCode: reg.data.devVerificationCode,
    },
  });
  const invited = await h.login(credentials.email);
  const invitation = await h.request(
    "/api/Restaurant/" + RID + "/invitations",
    { method: "POST", actor: owner, body: { email: credentials.email } },
  );
  assert.equal(invitation.status, 200);
  assert.deepEqual(Object.keys(invitation.data), ["message"]);
  const inviteCode = h.app
    .getState()
    .invitations.find((i) => i.email === credentials.email).code;
  assert.ok(!JSON.stringify(invitation.data).includes(inviteCode));
  const accept = { method: "POST", body: { code: inviteCode } };
  assert.equal(
    (await h.request("/api/Invitation/accept", { ...accept, actor: owner }))
      .status,
    403,
  );
  assert.equal(
    (await h.request("/api/Invitation/accept", { ...accept, actor: invited }))
      .data.role,
    "manager",
  );
  assert.equal(
    (await h.request("/api/Invitation/accept", { ...accept, actor: invited }))
      .status,
    200,
  );
  assert.equal(
    (await h.request("/api/Restaurant/my", { actor: invited })).data.length,
    1,
  );
  const point = await h.request("/api/Restaurant/CreatePOS", {
    method: "POST",
    actor: owner,
    body: { restaurantId: RID, pincode: "0123" },
  });
  assert.equal(point.status, 200);
  assert.ok(!("pinHash" in point.data));
  assert.ok(!("pincode" in point.data));
  assert.equal(
    (
      await h.request("/api/Restaurant/CreatePOS", {
        method: "POST",
        actor: owner,
        body: { restaurantId: RID, pincode: "0123" },
      })
    ).status,
    409,
  );
  const points = await h.request("/api/Restaurant/" + RID + "/pos", {
    actor: owner,
  });
  assert.equal(points.data.length, 1);
  assert.ok(!JSON.stringify(points.data).includes("0123"));
});

test("only the restaurant owner can invite admins; invalid invitation roles cannot grant other privileges", async (t) => {
  const h = await harness(t);
  const owner = await h.login();
  const admin = await h.login("admin@demo.test");
  const manager = await h.login("manager@demo.test");
  const invite = (actor, role, id = RID) =>
    h.request("/api/Restaurant/" + id + "/invitations", {
      method: "POST",
      actor,
      body: { email: "new@demo.test", role },
    });
  assert.equal((await invite(owner, "admin")).status, 200);
  assert.equal(h.app.getState().invitations.at(-1).role, "admin");
  assert.equal((await invite(admin, "admin")).status, 403);
  assert.equal((await invite(manager, "admin")).status, 403);
  assert.equal((await invite(manager, "manager")).status, 403);
  assert.equal((await invite(owner, "admin", OTHER)).status, 403);
  assert.equal((await invite(admin, "manager")).status, 200);
  assert.equal(h.app.getState().invitations.at(-1).role, "manager");
  assert.equal((await invite(admin, undefined)).status, 200);
  assert.equal(h.app.getState().invitations.at(-1).role, "manager");
  for (const role of [
    "owner",
    "cashier",
    "Admin",
    "root",
    "",
    null,
    true,
    1,
    {},
  ])
    assert.equal((await invite(owner, role)).status, 400);
  assert.equal(h.app.getState().invitations.length, 3);
});

test("admin invitation grants its saved role after email verification and ignores forged acceptance roles", async (t) => {
  const h = await harness(t);
  const owner = await h.login();
  const credentials = { email: "new-admin@demo.test", password: "Demo123!" };
  const created = await h.request("/api/Restaurant/" + RID + "/invitations", {
    method: "POST",
    actor: owner,
    body: { email: credentials.email, role: "admin" },
  });
  assert.equal(created.status, 200);
  const registration = await h.request("/api/Authority/RegisterUser", {
    method: "POST",
    body: credentials,
  });
  await h.request("/api/Authority/VerifyUser", {
    method: "POST",
    body: {
      email: credentials.email,
      verificationCode: registration.data.devVerificationCode,
    },
  });
  const invited = await h.login(credentials.email);
  const acceptance = {
    method: "POST",
    actor: invited,
    body: {
      code: h.app
        .getState()
        .invitations.find((i) => i.email === credentials.email).code,
      role: "owner",
      userId: owner.user.id,
    },
  };
  assert.equal(
    (await h.request("/api/Invitation/accept", acceptance)).data.role,
    "admin",
  );
  assert.equal(
    (await h.request("/api/Invitation/accept", acceptance)).data.role,
    "admin",
  );
  assert.equal(
    (await h.request("/api/Restaurant/my", { actor: invited })).data[0].role,
    "admin",
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/" + RID + "/employees", {
        actor: invited,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/" + RID + "/invitations", {
        method: "POST",
        actor: invited,
        body: { email: "next@demo.test", role: "admin" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/" + RID + "?userId=" + owner.user.id, {
        method: "DELETE",
        actor: invited,
      })
    ).status,
    403,
  );
});

test("a second invitation cannot silently promote an existing member or return a role they do not have", async (t) => {
  const h = await harness(t);
  const owner = await h.login();
  const credentials = { email: "duplicate@demo.test", password: "Demo123!" };
  const codes = [];
  for (const role of ["manager", "admin"]) {
    const result = await h.request("/api/Restaurant/" + RID + "/invitations", {
      method: "POST",
      actor: owner,
      body: { email: credentials.email, role },
    });
    assert.equal(result.status, 200);
    codes.push(h.app.getState().invitations.at(-1).code);
  }
  const registration = await h.request("/api/Authority/RegisterUser", {
    method: "POST",
    body: credentials,
  });
  await h.request("/api/Authority/VerifyUser", {
    method: "POST",
    body: {
      email: credentials.email,
      verificationCode: registration.data.devVerificationCode,
    },
  });
  const invited = await h.login(credentials.email);
  for (const code of codes) {
    const result = await h.request("/api/Invitation/accept", {
      method: "POST",
      actor: invited,
      body: { code, role: "owner" },
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.role, "manager");
  }
  assert.equal(
    (
      await h.request("/api/Restaurant/" + RID + "/employees", {
        actor: invited,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/" + RID + "/invitations", {
        method: "POST",
        actor: owner,
        body: { email: credentials.email, role: "admin" },
      })
    ).status,
    409,
  );
});

test("restaurant creation issues a supplier key, deletion cleans related resources and blocks manager", async (t) => {
  const h = await harness(t);
  const owner = await h.login();
  const created = await h.request("/api/Restaurant/create", {
    method: "POST",
    actor: owner,
    body: { userId: "spoofed", restaurantName: "Новый ресторан" },
  });
  assert.equal(created.status, 200);
  assert.ok(created.data.apiKey);
  const id = created.data.restaurantId;
  assert.equal(
    (await h.request("/api/Restaurant/my", { actor: owner })).data.find(
      (m) => m.restaurantId === id,
    ).role,
    "owner",
  );
  assert.equal(
    (
      await h.request(
        "/api/Supply/GetProducts?RestaurantId=" + id + "&ApiKey=bad",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request(
        "/api/Supply/GetProducts?RestaurantId=" +
          id +
          "&ApiKey=" +
          created.data.apiKey,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/" + id, {
        method: "DELETE",
        actor: owner,
      })
    ).status,
    200,
  );
  assert.equal(
    (await h.request("/api/Restaurant/my", { actor: owner })).data.some(
      (m) => m.restaurantId === id,
    ),
    false,
  );
  assert.equal(
    (await h.request("/api/Restaurant/" + id + "/snapshot", { actor: owner }))
      .status,
    404,
  );
});

test("WebSocket publishes external orders, stays restaurant-scoped and closes after logout", async (t) => {
  const h = await harness(t);
  const actor = await h.login();
  const s = stream(h.base, actor);
  t.after(() => s.ws.close());
  const initial = await s.next((f) => f.type === "restaurant.snapshot");
  assert.equal(initial.data.restaurantId, RID);
  assert.equal(initial.data.recommendations.length, 1);
  const other = stream(h.base, actor, OTHER);
  t.after(() => other.ws.close());
  await other.next((f) => f.data.restaurantId === OTHER);
  const result = await h.request(
    "/api/Demo/" + RID + "/order",
    orderOptions(actor, "ws-order"),
  );
  const frame = await s.next((f) =>
    f.data.recentOrders.some((o) => o.orderId === result.data.orderId),
  );
  assert.equal(frame.data.stopList.length, 1);
  assert.equal(frame.data.recommendations.length, 0);
  assert.ok(
    other.frames.every(
      (f) => f.data.restaurantId === OTHER && !f.data.recentOrders.length,
    ),
  );
  const closed = once(s.ws, "close");
  await h.request("/api/Authority/Logout", { method: "POST", actor });
  const [event] = await closed;
  assert.equal(event.code, 1008);
});

test("quiet-period expiry updates are pushed without orders or stock queries", async (t) => {
  let clock = Date.now();
  const h = await harness(t, { now: () => clock, accessTtlSeconds: 1000000 });
  const actor = await h.login();
  const s = stream(h.base, actor);
  t.after(() => s.ws.close());
  const first = await s.next((f) => f.type === "restaurant.snapshot");
  assert.equal(first.data.recommendations.length, 1);
  clock += 121 * 3600000;
  const expired = await s.next(
    (f) =>
      f.data.stopList.length === 1 &&
      f.data.batches.every((b) => b.expiryStatus === "expired"),
  );
  assert.equal(expired.data.recommendations.length, 0);
  assert.equal(expired.data.metrics.completedOrders, 0);
  assert.ok(expired.data.revision > first.data.revision);
});

test("expired pending supplies cannot be accepted and all stock stays unchanged", async (t) => {
  const h = await harness(t);
  const actor = await h.login();
  const initial = await h.snap(actor);
  await h.request("/api/Demo/" + RID + "/advance-time", {
    method: "POST",
    actor,
    body: { hours: 144 },
  });
  const before = await h.snap(actor);
  const result = await h.request(
    "/api/Supply/" +
      initial.supplies.find((s) => s.status === "pending").supplyId +
      "/accept",
    { method: "POST", actor, body: { restaurantId: RID } },
  );
  assert.equal(result.status, 409);
  assert.equal(result.data.code, "EXPIRED_SUPPLY");
  assert.deepEqual(
    (await h.snap(actor)).batches.map((b) => b.quantity),
    before.batches.map((b) => b.quantity),
  );
});

test("local persistence survives restart and stores hashes rather than plaintext secrets", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "restaurant-b-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, "store.json");
  const h = await harness(t, { filename });
  const actor = await h.login();
  await h.request(
    "/api/Demo/" + RID + "/order",
    orderOptions(actor, "persisted"),
  );
  const expired = (await h.snap(actor)).batches.find(
    (b) => b.expiryStatus === "expired",
  );
  await h.request(
    "/api/Restaurant/" + RID + "/expiry/" + expired.batchId + "/approve",
    { method: "POST", actor },
  );
  const menu = (await h.request("/api/Restaurant/" + RID + "/menu", { actor }))
    .data;
  const saved = await h.request("/api/Restaurant/" + RID + "/menu", {
    method: "PUT",
    actor,
    body: {
      version: menu.version,
      dishes: menu.dishes.map((d) => ({ ...d, name: "Сохранённое блюдо" })),
    },
  });
  assert.equal(saved.status, 200);
  await h.app.close();
  const legacy = JSON.parse(await readFile(filename, "utf8"));
  for (const restaurant of legacy.restaurants) {
    for (const product of restaurant.products) {
      product.unit = "pcs";
      product.shelfLifeDays = product.shelfLifeSeconds / 86400;
      delete product.shelfLifeSeconds;
    }
    for (const batch of restaurant.batches) batch.unit = "pcs";
    for (const supply of restaurant.supplies)
      for (const item of supply.items) item.unit = "pcs";
    for (const approval of restaurant.expiryApprovals) approval.unit = "pcs";
  }
  await writeFile(filename, JSON.stringify(legacy));
  const second = await harness(t, { filename });
  const nextActor = await second.login();
  const state = await second.snap(nextActor);
  assert.equal(state.recentOrders.length, 1);
  assert.equal(state.catalog[0].unit, "pcs");
  assert.equal(state.catalog[0].shelfLifeSeconds, 5 * 86400);
  assert.ok(!JSON.stringify(state.catalog).includes('"shelfLifeDays"'));
  for (const list of [state.batches, state.supplies, state.expiryApprovals])
    assert.ok(!JSON.stringify(list).includes('"unit"'));
  assert.equal(state.expiryApprovals.length, 1);
  assert.equal(state.expiryApprovals[0].batchId, expired.batchId);
  assert.equal(state.menu[0].name, "Сохранённое блюдо");
  assert.equal(state.menuVersion, saved.data.version);
  const contents = await readFile(filename, "utf8");
  assert.ok(!contents.includes("Demo123!"));
  assert.ok(!contents.includes("demo-supplier-key"));
});

test("menu replacement preserves dish IDs, stock and order history while new recipes update availability and WebSocket", async (t) => {
  const h = await harness(t, { now: () => Date.UTC(2026, 9, 14, 12) });
  const actor = await h.login();
  await h.request(
    "/api/Demo/" + RID + "/order",
    orderOptions(actor, "before-recipe-edit"),
  );
  const before = await h.snap(actor);
  assert.equal(before.menu[0].availablePortions, 0);
  const socket = stream(h.base, actor);
  t.after(() => socket.ws.close());
  await socket.next((f) => f.type === "restaurant.snapshot");
  const result = await h.request("/api/Restaurant/" + RID + "/menu", {
    method: "PUT",
    actor,
    body: {
      version: before.menuVersion,
      dishes: [
        {
          dishId: DISH,
          name: "Новый салат",
          recipe: [
            { productId: TOMATO, quantity: 0.5 },
            { productId: CUCUMBER, quantity: 0.25 },
          ],
        },
        { name: "Огурцы", recipe: [{ productId: CUCUMBER, quantity: 0.125 }] },
      ],
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.dishes[0].dishId, DISH);
  assert.equal(result.data.version, before.menuVersion + 1);
  const pushed = await socket.next(
    (f) => f.data?.menuVersion === result.data.version,
  );
  assert.equal(pushed.data.menu.length, 2);
  const after = await h.snap(actor);
  assert.deepEqual(after.batches, before.batches);
  assert.deepEqual(after.recentOrders, before.recentOrders);
  assert.equal(after.recentOrders[0].items[0].name, "Овощной салат");
  assert.equal(after.menu[0].availablePortions, 2);
  assert.equal(after.menu[1].availablePortions, 8);
  assert.equal(after.stopList.length, 0);
  const order = await h.request(
    "/api/Demo/" + RID + "/order",
    orderOptions(actor, "after-recipe-edit"),
  );
  assert.equal(order.status, 200);
  const ordered = await h.snap(actor);
  assert.equal(usable(ordered, TOMATO), usable(after, TOMATO) - 0.5);
  assert.equal(usable(ordered, CUCUMBER), usable(after, CUCUMBER) - 0.25);
  assert.equal(ordered.menuVersion, result.data.version);
});

test("menu validation rejects every invalid recipe atomically and enforces restaurant-scoped owner/admin permissions", async (t) => {
  const h = await harness(t);
  const owner = await h.login();
  const admin = await h.login("admin@demo.test");
  const manager = await h.login("manager@demo.test");
  const url = "/api/Restaurant/" + RID + "/menu";
  const before = (await h.request(url, { actor: owner })).data;
  const good = before.dishes[0];
  const created = (
    await h.request("/api/Restaurant/create", {
      method: "POST",
      actor: owner,
      body: { restaurantName: "Меню с нуля" },
    })
  ).data;
  const childUrl = "/api/Restaurant/" + created.restaurantId;
  const emptyMenu = (await h.request(childUrl + "/menu", { actor: owner }))
    .data;
  assert.deepEqual(emptyMenu.dishes, []);
  assert.equal(emptyMenu.version, 1);
  const childProduct = (
    await h.request(childUrl + "/products", {
      method: "PUT",
      actor: owner,
      body: [{ name: "Соль", shelfLifeDays: 365 }],
    })
  ).data[0];
  const childMenu = await h.request(childUrl + "/menu", {
    method: "PUT",
    actor: owner,
    body: {
      version: emptyMenu.version,
      dishes: [
        {
          name: "Солёное блюдо",
          recipe: [{ productId: childProduct.productId, quantity: 1 }],
        },
      ],
    },
  });
  assert.equal(childMenu.status, 200);
  assert.equal(
    (await h.snap(owner, created.restaurantId)).menu[0].availablePortions,
    0,
  );
  const body = (dish = good) => ({ version: before.version, dishes: [dish] });
  assert.equal((await h.request(url)).status, 401);
  assert.equal((await h.request(url, { actor: manager })).status, 403);
  assert.equal(
    (await h.request(url, { method: "PUT", actor: manager, body: body() }))
      .status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/Restaurant/" + OTHER + "/menu", {
        method: "PUT",
        actor: owner,
        body: body(),
      })
    ).status,
    403,
  );
  assert.equal((await h.request(url, { actor: admin })).status, 200);
  const badDishes = [
    { ...good, name: " " },
    { ...good, recipe: [] },
    { ...good, recipe: [{ productId: childProduct.productId, quantity: 1 }] },
    { ...good, recipe: [{ productId: "foreign-product", quantity: 1 }] },
    {
      ...good,
      recipe: [
        { productId: TOMATO, quantity: 1 },
        { productId: TOMATO, quantity: 2 },
      ],
    },
    ...[0, -1, 0.0001, 1e10, "1", null].map((quantity) => ({
      ...good,
      recipe: [{ productId: TOMATO, quantity }],
    })),
  ];
  for (const dish of badDishes)
    assert.equal(
      (await h.request(url, { method: "PUT", actor: owner, body: body(dish) }))
        .status,
      400,
    );
  for (const dishes of [
    [good, { ...good, dishId: undefined, name: " овОщной салат " }],
    [good, { ...good, name: "Другой салат" }],
    [good, { name: "Невалидное блюдо", recipe: [] }],
  ])
    assert.equal(
      (
        await h.request(url, {
          method: "PUT",
          actor: owner,
          body: { version: before.version, dishes },
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await h.request(url, {
        method: "PUT",
        actor: owner,
        body: body({ ...good, dishId: "foreign-dish" }),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await h.request(url, {
        method: "PUT",
        actor: owner,
        body: body({ ...good, dishId: childMenu.data.dishes[0].dishId }),
      })
    ).status,
    404,
  );
  for (const payload of [
    null,
    {},
    { version: "1", dishes: [] },
    { version: 1.5, dishes: [] },
  ])
    assert.equal(
      (await h.request(url, { method: "PUT", actor: owner, body: payload }))
        .status,
      400,
    );
  assert.deepEqual((await h.request(url, { actor: owner })).data, before);
  assert.equal(
    (await h.request(url, { method: "PUT", actor: admin, body: body() }))
      .status,
    200,
  );
});

test("menu versions reject concurrent stale saves but stock changes do not conflict with menu editing", async (t) => {
  const h = await harness(t);
  const actor = await h.login();
  const url = "/api/Restaurant/" + RID + "/menu";
  const before = (await h.request(url, { actor })).data;
  await h.request(
    "/api/Demo/" + RID + "/order",
    orderOptions(actor, "stock-while-editing"),
  );
  const saves = await Promise.all(
    ["Первый редактор", "Второй редактор"].map((name) =>
      h.request(url, {
        method: "PUT",
        actor,
        body: {
          version: before.version,
          dishes: [{ ...before.dishes[0], name }],
        },
      }),
    ),
  );
  assert.deepEqual(saves.map((r) => r.status).sort(), [200, 409]);
  assert.equal(saves.find((r) => r.status === 409).data.code, "MENU_CHANGED");
  const winner = saves.find((r) => r.status === 200).data;
  assert.deepEqual((await h.request(url, { actor })).data, winner);
  assert.equal((await h.snap(actor)).recentOrders.length, 1);
});

test("replacing or clearing the whole menu removes dishes from sale while keeping past orders and stock", async (t) => {
  const h = await harness(t, { now: () => Date.UTC(2026, 9, 14, 12) });
  const actor = await h.login();
  const url = "/api/Restaurant/" + RID + "/menu";
  await h.request(
    "/api/Demo/" + RID + "/order",
    orderOptions(actor, "history-before-menu-removal"),
  );
  const before = await h.snap(actor);
  const replacement = await h.request(url, {
    method: "PUT",
    actor,
    body: {
      version: before.menuVersion,
      dishes: [
        {
          name: "Новые огурцы",
          recipe: [{ productId: CUCUMBER, quantity: 0.125 }],
        },
      ],
    },
  });
  assert.equal(replacement.status, 200);
  assert.notEqual(replacement.data.dishes[0].dishId, DISH);
  assert.equal(
    (
      await h.request(
        "/api/Demo/" + RID + "/order",
        orderOptions(actor, "removed-dish"),
      )
    ).status,
    404,
  );
  const cleared = await h.request(url, {
    method: "PUT",
    actor,
    body: { version: replacement.data.version, dishes: [] },
  });
  assert.equal(cleared.status, 200);
  const after = await h.snap(actor);
  assert.deepEqual(after.menu, []);
  assert.deepEqual(after.stopList, []);
  assert.deepEqual(after.recommendations, []);
  assert.deepEqual(after.batches, before.batches);
  assert.deepEqual(after.catalog, before.catalog);
  assert.deepEqual(after.recentOrders, before.recentOrders);
});

test("expiry stays unusable before approval, then writes off only that batch and keeps manager audit", async (t) => {
  const h = await harness(t);
  const actor = await h.login("manager@demo.test");
  const before = await h.snap(actor);
  const expired = before.batches.find((b) => b.expiryStatus === "expired");
  assert.equal(expired.quantity, 3);
  assert.equal(expired.supplyNumber, "DEMO-004");
  assert.equal(usable(before, TOMATO), 3);
  const options = {
    method: "POST",
    actor,
    body: { userId: "spoofed", quantity: 999 },
  };
  const url =
    "/api/Restaurant/" + RID + "/expiry/" + expired.batchId + "/approve";
  const result = await h.request(url, options);
  assert.equal(result.status, 200);
  assert.equal(result.data.approval.approvedBy, actor.user.id);
  assert.equal(result.data.approval.approvedByEmail, "manager@demo.test");
  assert.equal(result.data.approval.quantity, 3);
  const after = await h.snap(actor);
  assert.equal(usable(after, TOMATO), 3);
  assert.equal(
    after.batches.some((b) => b.batchId === expired.batchId),
    false,
  );
  assert.equal(after.expiryApprovals.length, 1);
  assert.equal(after.metrics.expiredBatches, 0);
  assert.deepEqual(
    after.batches.map((b) => [b.batchId, b.quantity]),
    before.batches
      .filter((b) => b.batchId !== expired.batchId)
      .map((b) => [b.batchId, b.quantity]),
  );
  const retry = await h.request(url, options);
  assert.deepEqual(retry.data.approval, result.data.approval);
  assert.equal((await h.snap(actor)).expiryApprovals.length, 1);
  assert.equal(
    (
      await h.request(
        "/api/Demo/" + RID + "/order",
        orderOptions(actor, "after-expiry-approval"),
      )
    ).status,
    200,
  );
});

test("expiry approval rejects fresh/foreign batches and requires restaurant membership", async (t) => {
  const h = await harness(t);
  const owner = await h.login();
  const manager = await h.login("manager@demo.test");
  const before = await h.snap(owner);
  const expired = before.batches.find((b) => b.expiryStatus === "expired");
  const fresh = before.batches.find((b) => b.expiryStatus === "fresh");
  const url = (rid, id) =>
    "/api/Restaurant/" + rid + "/expiry/" + id + "/approve";
  const freshResult = await h.request(url(RID, fresh.batchId), {
    method: "POST",
    actor: owner,
  });
  assert.equal(freshResult.status, 409);
  assert.equal(freshResult.data.code, "NOT_EXPIRED");
  assert.equal(
    (
      await h.request(url(OTHER, expired.batchId), {
        method: "POST",
        actor: owner,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await h.request(url(OTHER, expired.batchId), {
        method: "POST",
        actor: manager,
      })
    ).status,
    403,
  );
  assert.equal(
    (await h.request(url(RID, expired.batchId), { method: "POST" })).status,
    401,
  );
  assert.equal((await h.snap(owner)).expiryApprovals.length, 0);
  assert.deepEqual(
    (await h.snap(owner)).batches.map((b) => [b.batchId, b.quantity]),
    before.batches.map((b) => [b.batchId, b.quantity]),
  );
});

test("two managers approving the same batch produce one record and shared WebSocket state", async (t) => {
  const h = await harness(t);
  const owner = await h.login();
  const manager = await h.login("manager@demo.test");
  const a = stream(h.base, owner);
  const b = stream(h.base, manager);
  t.after(() => {
    a.ws.close();
    b.ws.close();
  });
  const first = await a.next((f) => f.type === "restaurant.snapshot");
  await b.next((f) => f.type === "restaurant.snapshot");
  const expired = first.data.batches.find((x) => x.expiryStatus === "expired");
  const path =
    "/api/Restaurant/" + RID + "/expiry/" + expired.batchId + "/approve";
  const results = await Promise.all(
    [owner, manager].map((actor) => h.request(path, { method: "POST", actor })),
  );
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(
    results[0].data.approval.approvalId,
    results[1].data.approval.approvalId,
  );
  const frames = await Promise.all(
    [a, b].map((s) => s.next((f) => f.data.expiryApprovals.length === 1)),
  );
  assert.ok(
    frames.every(
      (f) =>
        f.data.metrics.expiredBatches === 0 &&
        !f.data.batches.some((x) => x.batchId === expired.batchId),
    ),
  );
  assert.equal(
    h.app.getState().restaurants.find((r) => r.id === RID).expiryApprovals
      .length,
    1,
  );
});

test("newly expired batches appear again after older approvals, without reviving confirmed stock", async (t) => {
  const h = await harness(t);
  const actor = await h.login();
  const before = await h.snap(actor);
  const old = before.batches.find((b) => b.expiryStatus === "expired");
  await h.request(
    "/api/Restaurant/" + RID + "/expiry/" + old.batchId + "/approve",
    { method: "POST", actor },
  );
  await h.request("/api/Demo/" + RID + "/advance-time", {
    method: "POST",
    actor,
    body: { hours: 24 },
  });
  const after = await h.snap(actor);
  const pending = after.batches.filter((b) => b.expiryStatus === "expired");
  assert.equal(pending.length, 1);
  assert.notEqual(pending[0].batchId, old.batchId);
  assert.equal(after.expiryApprovals.length, 1);
  assert.equal(usable(after, TOMATO), 2);
});
