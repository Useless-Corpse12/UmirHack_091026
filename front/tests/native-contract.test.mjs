import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const native = read('../src/shared/api/nativeBackendApi.ts');
const routes = read('../src/app/router/index.tsx');
const rest = read('../src/shared/api/restaurantsApi.ts');
const views = read('../src/pages/native/NativePages.tsx');
const catalog = read('../src/pages/native/NativeCatalogPage.tsx');
const deliveries = read('../src/pages/native/NativeDeliveriesPage.tsx');

test('uses only supplied backend command routes (no invented compatibility adapter)', () => {
  for (const name of ['GetUserRestaurants', 'GetRestaurantMembers', 'RemoveRestaurantMember', 'DirectInvite', 'SetProducts', 'LoadRestaurantMenu', 'AcceptSupply', 'RejectSupply']) {
    assert.ok(native.includes(name), `missing source API route ${name}`);
  }
  assert.ok(native.includes('/api/POS/menu'));
  assert.ok(rest.includes('nativeBackendApi.memberships'));
  assert.ok(rest.includes('nativeBackendApi.createRestaurant'));
});
test('POS user interface is removed, but read-only POS/menu can still be used', () => {
  assert.ok(!routes.includes('path="pos"'));
  assert.ok(!routes.includes('PosPointsPage'));
  assert.equal(existsSync(new URL('../src/pages/PosPointsPage.tsx', import.meta.url)),false);
});
test('product update is visibly destructive, never presented as safe merge', () => {
  assert.ok(catalog.includes('Заменить продукты и меню?'));
  assert.ok(catalog.includes('await api.replaceCatalog(restaurantId, validated.products)'));
  assert.ok(!native.includes('/products/merge'));
});
test('native views do not make missing analytics / warehouse endpoint requests', () => {
  assert.ok(!native.includes('/analytics'));
  assert.ok(!native.includes('/snapshot'));
  assert.ok(deliveries.includes('parseIncomingSupplies'));
  assert.ok(deliveries.includes('api.acceptSupply'));
  assert.ok(!native.includes('GetSupplies'));
  assert.ok(views.includes('FoodStock'));
  assert.ok(views.includes('По продуктам'));
});
