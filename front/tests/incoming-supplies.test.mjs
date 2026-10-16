import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseIncomingSupplies } from '../src/shared/realtime/incomingSupplies.ts';
const supplyId = '11111111-1111-1111-1111-111111111111';
const productId = '22222222-2222-2222-2222-222222222222';
const record = (changes = {}) => ({ supplyId, status: 'pending', items: [{productId, productName: 'Мука', arrivedQuantity: 10}], ...changes });
test('incoming supply reads only real IDs and explicit quantities', () => {
  assert.deepEqual(parseIncomingSupplies([record()]), [{supplyId, items:[{productId, productName:'Мука', arrivedQuantity:10, unit:''}], arrivedAt:undefined, supplier:undefined}]);
  assert.deepEqual(parseIncomingSupplies([record({supplyId:'fake'})]), []);
  assert.deepEqual(parseIncomingSupplies([record({items:[{productId, productName:'Мука'}]})]), []);
  assert.deepEqual(parseIncomingSupplies([record({items:[{productId, productName:'Мука', arrivedQuantity:0}]})])[0].items[0].arrivedQuantity,0);
});
test('accepted supply history or unmarked analytical events cannot be re-accepted', () => {
  assert.deepEqual(parseIncomingSupplies([record({status:'accepted'})]), []);
  assert.deepEqual(parseIncomingSupplies([record({status:undefined})], true), []);
  assert.equal(parseIncomingSupplies([record()], true).length,1);
  assert.deepEqual(parseIncomingSupplies([record({items:[{productId, arrivedQuantity:'some'}]})]), []);
});
test('operator interface uses server command routes only and has three distinct actions', () => {
  // Source-level check also covers the manual fallback when server has no readable supply list.
  const page = readFileSync(new URL('../src/pages/native/NativeDeliveriesPage.tsx', import.meta.url), 'utf8');
  for (const label of ['Отказ', 'Принять', 'Принять всё', 'Приёмка по UUID вручную']) assert.ok(page.includes(label));
  assert.ok(page.includes('action === "all" ? row.arrivedQuantity'));
  assert.ok(page.includes('await api.acceptSupply(supply.supplyId, items)'));
  assert.ok(page.includes('await api.rejectSupply(restaurantId, supply.supplyId)'));
});
