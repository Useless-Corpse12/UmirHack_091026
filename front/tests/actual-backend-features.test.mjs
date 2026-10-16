import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
const root = path.resolve(import.meta.dirname, "../");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
test("AcceptInvite uses the current AuthorityController with token and userId", () => {
  const src = read("src/shared/api/nativeBackendApi.ts");
  assert.match(src, /post\("\/api\/Authority\/AcceptInvite", \{ token, userId: currentUserId\(\) \}\)/);
  assert.match(read("src/pages/RestaurantsPage.tsx"), /Присоединиться по коду/);
  assert.match(read("src/pages/InvitePage.tsx"), /Принять приглашение/);
});
test("POS creation remains available as configuration, not a cash-register UI", () => {
  const src = read("src/pages/native/NativeTerminalsPage.tsx");
  assert.match(src, /createPOS\(restaurantId, pin\)/);
  assert.match(read("src/shared/api/nativeBackendApi.ts"), /\/api\/Restaurant\/CreatePOS/);
  assert.match(read("src/app/router/index.tsx"), /path="terminals"/);
  assert.doesNotMatch(read("src/app/router/index.tsx"), /path="pos"/);
});
test("visual catalog validates ingredient names and sends full products before menu", () => {
  const src = read("src/pages/native/NativeCatalogPage.tsx");
  const a = src.indexOf("await api.replaceCatalog(restaurantId, validated.products)");
  const b = src.indexOf("await api.replaceMenu(restaurantId, validated.menu)");
  assert.ok(a > 0 && b > a);
  assert.match(src, /if \(!names.has\(item.name\)\)/);
  assert.match(src, /Частичное сохранение/);
  assert.match(src, /Заменить продукты и меню/);
  assert.match(src, /Окей, отправить/);
  assert.match(src, /Добавить ещё продукт/);
  assert.match(src, /Конструктор меню/);
  assert.match(src, /localStorage\.setItem\(draftKey/);
});
test("supplier key is fetched only on demand for owner, not stored in membership", () => {
  const api = read("src/shared/api/nativeBackendApi.ts");
  const settings = read("src/pages/SettingsPage.tsx");
  assert.match(api, /async supplierApiKey\(restaurantId/);
  assert.match(api, /normalizeRole\(entry.role\) !== "owner"/);
  assert.match(api, /return typeof entry.apiKey === "string"/);
  assert.match(settings, /nativeBackendApi\.supplierApiKey\(restaurantId/);
  assert.match(settings, /Скопировать/);
  assert.doesNotMatch(settings, /localStorage\.setItem/);
});
test("SignalR LongPolling uses the original notification hub and listens to all four broadcasts", () => {
  const src = read("src/shared/realtime/nativeSignalR.ts");
  for (const message of ["ProductsUpdated", "AnalyticsUpdated", "StopListUpdated", "RecommendationsUpdated", "JoinRestaurant"])
    assert.ok(src.includes(message), message);
  assert.match(src, /\/hubs\/notifications/);
  assert.match(read("vite.config.ts"), /"\/hubs": \{ target: backendTarget/);
  assert.match(src, /Authorization: `Bearer \$\{token\}`/);
});
test("manual API key is not falsely advertised as persisted in the unchanged server", () => {
  const src = read("src/pages/RestaurantsPage.tsx");
  assert.doesNotMatch(src, /ручной ввод здесь пока технически невозможен/);
  assert.match(read("src/shared/api/nativeBackendApi.ts"), /restaurantName: name/);
});
