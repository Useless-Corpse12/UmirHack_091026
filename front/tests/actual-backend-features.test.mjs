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
test("products then menu are submitted as one sequential action", () => {
  const src = read("src/pages/native/NativeCatalogPage.tsx");
  const a = src.indexOf("await api.replaceCatalog(restaurantId, products)");
  const b = src.indexOf("await api.replaceMenu(restaurantId, menu)");
  assert.ok(a > 0 && b > a);
  assert.match(src, /if \(!productNames.has\(ingredient\)\)/);
  assert.match(src, /продукты уже могут измениться|Продукты уже отправлены/i);
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
  assert.match(src, /ручной ввод здесь пока технически невозможен/);
});
