import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('live catalog uses visual product/recipe editor with two-step publication confirmation', () => {
  const src = read('../src/pages/native/NativeCatalogPage.tsx');
  for (const part of ['Конструктор меню', 'Каталог продуктов', 'Добавить ещё продукт', 'Заменить продукты и меню?', 'Окей, отправить']) assert.ok(src.includes(part),part);
  const product = src.indexOf('await api.replaceCatalog(restaurantId, validated.products)');
  const dish = src.indexOf('await api.replaceMenu(restaurantId, validated.menu)');
  assert.ok(product >= 0 && dish > product);
});
test('owner supplier key comes from GetUserRestaurants and is shown in settings only', () => {
  const settings=read('../src/pages/SettingsPage.tsx');
  const api=read('../src/shared/api/nativeBackendApi.ts');
  for (const part of ['nativeBackendApi.supplierApiKey(restaurantId', 'Показать', 'Скопировать', 'API-ключ поставщика']) assert.ok(settings.includes(part),part);
  assert.match(api, /GetUserRestaurants/);
  assert.ok(!settings.includes('localStorage.setItem'));
});
test('operational disclaimer banners are gone but real errors and destructive confirmation remain', () => {
  const native=read('../src/pages/native/NativePages.tsx');
  const terminals=read('../src/pages/native/NativeTerminalsPage.tsx');
  const deliveries=read('../src/pages/native/NativeDeliveriesPage.tsx');
  const catalog=read('../src/pages/native/NativeCatalogPage.tsx');
  for (const text of ['Ожидаем первые данные от сервера', 'нет методов получения сводки склада', 'Денежные показатели пока недоступны', 'Важно знать']) assert.ok(!native.includes(text), text);
  assert.ok(!terminals.includes('Повторная регистрация может не пройти'));
  assert.ok(!deliveries.includes('Нужны идентификаторы из системы поставщика'));
  assert.ok(catalog.includes('Заменить продукты и меню?'));
  assert.ok(deliveries.includes('Отказ') && deliveries.includes('Принять всё'));
});
test('native restaurant UI keeps POS creation, invitation flow, and SignalR events', () => {
  const terminals=read('../src/pages/native/NativeTerminalsPage.tsx');
  const backend=read('../src/shared/api/nativeBackendApi.ts');
  const signalr=read('../src/shared/realtime/nativeSignalR.ts');
  assert.ok(terminals.includes('nativeBackendApi.createPOS(restaurantId, pin)'));
  assert.ok(backend.includes('/api/Authority/AcceptInvite'));
  for (const e of ['ProductsUpdated', 'AnalyticsUpdated', 'StopListUpdated', 'RecommendationsUpdated']) assert.ok(signalr.includes(e));
});
