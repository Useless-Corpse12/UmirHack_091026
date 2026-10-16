import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createDemoServer } from "../demo/server.mjs";

const RID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function withDemo(t) {
  const app = createDemoServer();
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = async (path, options = {}) => {
    const response = await fetch(base + path, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return { status: response.status, data: await response.json() };
  };
  const login = await request("/api/Authority/AuthorizeUser", {
    method: "POST", body: { email: "owner@demo.test", password: "Demo123!" },
  });
  assert.equal(login.status, 200);
  const token = login.data.accessToken;
  const catalog = `/api/Restaurant/${RID}/products`;
  const get = async () => (await request(catalog, { token })).data;
  const merge = (body) => request(`${catalog}/merge`, { token, method: "POST", body });
  return { request, token, get, merge, catalog };
}

test("manual add via POST /products/merge preserves all other products", async (t) => {
  const api = await withDemo(t);
  const before = await api.get();
  assert.ok(before.length >= 2);
  const newProduct = { name: "Сельдерей", shelfLifeSeconds: 59000, unit: "кг" };
  const added = await api.merge([newProduct]);
  assert.equal(added.status, 200);
  assert.equal(added.data.length, before.length + 1);
  for (const old of before) assert.deepEqual(added.data.find((p) => p.productId === old.productId), old);
  assert.ok(added.data.some((p) => p.name === "Сельдерей"));
});

test("JSON import only upserts included records, never drops existing records", async (t) => {
  const api = await withDemo(t);
  const initial = await api.get();
  const first = initial[0];
  const incoming = [
    { productId: first.productId, name: first.name, unit: "ящик", shelfLifeSeconds: 42 },
    { name: "Пакеты", unit: "шт.", shelfLifeSeconds: 86400 },
  ];
  const after = await api.merge(incoming);
  assert.equal(after.status, 200);
  assert.equal(after.data.length, initial.length + 1);
  assert.deepEqual(after.data.find((p) => p.productId === first.productId), {
    ...first, unit: "ящик", shelfLifeSeconds: 42,
  });
  for (const old of initial.slice(1)) {
    assert.deepEqual(after.data.find((p) => p.productId === old.productId), old);
  }
  const repeat = await api.merge(incoming);
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.length, initial.length + 1);
});

test("invalid import rolls back entirely and unauthorized mutation is rejected", async (t) => {
  const api = await withDemo(t);
  const before = await api.get();
  const bad = await api.merge([
    { name: "Соль", shelfLifeSeconds: 5000, unit: "кг" },
    { name: "  ", shelfLifeSeconds: 5000, unit: "шт." },
  ]);
  assert.equal(bad.status, 400);
  assert.deepEqual(await api.get(), before);
  const guest = await api.request(`${api.catalog}/merge`, {
    method: "POST", body: [{ name: "Гость", shelfLifeSeconds: 5000 }],
  });
  assert.equal(guest.status, 401);
  assert.deepEqual(await api.get(), before);
});

test("legacy PUT also preserves old rows for outdated clients", async (t) => {
  const api = await withDemo(t);
  const before = await api.get();
  const response = await api.request(api.catalog, {
    token: api.token, method: "PUT",
    body: [{ name: "Гвоздика", shelfLifeSeconds: 6000, unit: "г" }],
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.length, before.length + 1);
});
