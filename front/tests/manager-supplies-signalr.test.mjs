import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSupplySignal, mergeIncomingSupplies } from '../src/shared/realtime/incomingSupplies.ts';

const ID1 = '11111111-1111-1111-1111-111111111111';
const ID2 = '22222222-2222-2222-2222-222222222222';
const PRODUCT = '33333333-3333-3333-3333-333333333333';
const backendEvent = (supplyId, productName = 'Мука') => [{
  supplyId, supplyNumber: 'SUP-2026-001', createdAt: '2026-10-16T08:10:00Z',
  status: 'pending', items: [{ productId: PRODUCT, productName, quantity: 12, expiresAt: '2026-10-17T08:10:00Z' }],
}];

test('manager.supplies handler accepts the exact SupplyIncomingHandler array envelope', () => {
  const signalRFrame = JSON.stringify({type:1, target:'manager.supplies', arguments:[backendEvent(ID1)]}) + '\x1e';
  const decoded = JSON.parse(signalRFrame.slice(0, -1));
  const event = parseSupplySignal(decoded.target, decoded.arguments[0]);
  assert.deepEqual(event, { mode:'append', data:[{
    supplyId:ID1, supplyNumber:'SUP-2026-001', arrivedAt:'2026-10-16T08:10:00Z', supplier:undefined,
    items:[{ productId:PRODUCT, productName:'Мука', arrivedQuantity:12, expiresAt:'2026-10-17T08:10:00Z', unit:'' }],
  }] });
});

test('one new delivery never replaces another; replay is idempotent', () => {
  let pending = mergeIncomingSupplies(null, parseSupplySignal('MANAGER.SUPPLIES', backendEvent(ID1)).data, 'append');
  pending = mergeIncomingSupplies(pending, parseSupplySignal('manager.supplies', backendEvent(ID2)).data, 'append');
  assert.equal(pending.length, 2);
  pending = mergeIncomingSupplies(pending, parseSupplySignal('manager.supplies', backendEvent(ID1)).data, 'append');
  assert.deepEqual(pending.map(s => s.supplyId), [ID1,ID2]);
  const snapshot = parseSupplySignal('SuppliesUpdated', backendEvent(ID2));
  assert.equal(snapshot.mode, 'replace');
  assert.deepEqual(mergeIncomingSupplies(pending,snapshot.data,snapshot.mode).map(s=>s.supplyId),[ID2]);
});

test('does not display processed events, unknown methods, or invented IDs', () => {
  assert.deepEqual(parseSupplySignal('manager.supplies', backendEvent(ID1).map(s=>({...s,status:'accepted'}))), {mode:'append',data:[]});
  assert.deepEqual(parseSupplySignal('manager.supplies', backendEvent('not-a-guid')), {mode:'append',data:[]});
  assert.equal(parseSupplySignal('manager.news',backendEvent(ID1)),null);
  assert.equal(parseSupplySignal('supplyarrived',backendEvent(ID1)).mode,'append');
  assert.equal(parseSupplySignal('manager.supplies',backendEvent(ID1,'Unknown')).data[0].items[0].productName, 'Продукт 33333333');
});

test('SignalR route, JoinRestaurant, authenticated transport and processed-card removal are wired', () => {
  const dir = new URL('../src/',import.meta.url);
  const signalR = readFileSync(new URL('shared/realtime/nativeSignalR.ts',dir), 'utf8');
  const store = readFileSync(new URL('shared/realtime/nativeLiveStore.ts',dir),'utf8');
  const layout = readFileSync(new URL('pages/native/NativePages.tsx',dir),'utf8');
  const page = readFileSync(new URL('pages/native/NativeDeliveriesPage.tsx',dir),'utf8');
  assert.ok(signalR.includes('/hubs/notifications'));
  assert.ok(signalR.includes('JoinRestaurant'));
  assert.ok(signalR.includes('parseSupplySignal(msg.target, arg)'));
  assert.ok(signalR.includes('Authorization: `Bearer ${token}`'));
  assert.ok(store.includes('mergeIncomingSupplies(state.supplies'));
  assert.ok(store.includes('markSupplyProcessed: (restaurantId, supplyId)'));
  assert.ok(layout.includes('receive(restaurantId, event)'));
  assert.ok(layout.includes('pendingCount'));
  assert.ok(page.includes('markSupplyProcessed(restaurantId, supply.supplyId)'));
  assert.ok(page.includes('action === "all" ? row.arrivedQuantity'));
});
