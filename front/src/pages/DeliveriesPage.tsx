import { useState } from "react";
import { useDeliveries } from "../features/restaurant-runtime/hooks";
import { ErrorNotice, SnapshotStatus } from "../shared/ui/Feedback";
import { dateLabel } from "../shared/lib/format";
import type { Supply, SupplyItem } from "../shared/types/models";

const label: Record<Supply["status"], string> = {
  pending: "Ожидает решения", accepted: "Полностью принята",
  partial: "Частично принята", rejected: "Отклонена",
};
export const DeliveriesPage = () => {
  const { data, accept, reject, pendingIds, errors } = useDeliveries();
  const [filter, setFilter] = useState("pending");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const keyFor = (supplyId: string, productId: string) => `${supplyId}:${productId}`;
  const fact = (supplyId: string, item: SupplyItem) => quantities[keyFor(supplyId, item.productId)] ?? item.quantity;
  const rows = (data ?? []).filter((s) => filter === "all" || s.status === filter)
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const acceptSupply = (s: Supply) => {
    const items = s.items.map((item) => ({ ...item, factQuantity: fact(s.supplyId, item) }));
    void accept(s.supplyId, items).catch(() => {});
  };
  return <div>
    <h2 className="text-2xl font-bold mb-2">Поставки</h2>
    <p className="mb-4 text-sm text-gray-600">Проверь фактическое количество каждой позиции. Если принято меньше, система зафиксирует частичную приёмку. Для полного отказа используй отдельную кнопку.</p>
    <SnapshotStatus />
    <label className="block mb-4 text-sm">Статус
      <select aria-label="Фильтр поставок" className="block border bg-white p-2 rounded mt-2" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="pending">Ожидают решения</option>
        <option value="all">Все</option>
        <option value="accepted">Приняты полностью</option>
        <option value="partial">Приняты частично</option>
        <option value="rejected">Отклонены</option>
      </select>
    </label>
    <div className="space-y-4">
      {rows.map((s) => <section key={s.supplyId} data-testid="supply-card" data-status={s.status} className="rounded-lg p-5 border bg-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div><h3 className="font-semibold">{s.supplyNumber}</h3><p className="text-gray-500 text-sm">{dateLabel(s.createdAt)}</p></div>
          <span className={`px-3 py-1 rounded text-sm ${s.status === "pending" ? "bg-amber-100 text-amber-800" : s.status === "rejected" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{label[s.status]}</span>
        </div>
        <div className="mt-4 space-y-3">
          {s.items.map((item) => <div key={item.productId} className="flex gap-4 flex-wrap items-center justify-between border-b pb-3 last:border-0">
            <div className="text-sm"><p className="font-medium">{item.productName}</p><p className="text-gray-500">Привезли: {item.quantity} · Годен до {dateLabel(item.expiresAt)}</p></div>
            {s.status === "pending" ? <label className="text-sm">Фактически принято
              <input type="number" step="1" min="0" max={item.quantity}
                disabled={pendingIds.includes(s.supplyId)}
                aria-label={`Принято ${item.productName}`}
                className="block w-28 px-3 py-2 border rounded mt-1"
                value={fact(s.supplyId, item)}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= item.quantity)
                    setQuantities((old) => ({ ...old, [keyFor(s.supplyId, item.productId)]: parsed }));
                }} />
            </label> : <p className="text-sm">Принято: {item.factQuantity ?? (s.status === "accepted" ? item.quantity : 0)}</p>}
          </div>)}
        </div>
        {s.status === "pending" && <div className="flex gap-3 flex-wrap mt-4">
          <button className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-40" disabled={pendingIds.includes(s.supplyId) || s.items.every(i => fact(s.supplyId, i) === 0)} onClick={() => acceptSupply(s)}>Принять указанное</button>
          <button className="border border-red-300 text-red-700 px-4 py-2 rounded disabled:opacity-40" disabled={pendingIds.includes(s.supplyId)} onClick={() => void reject(s.supplyId).catch(() => {})}>Отклонить поставку</button>
        </div>}
        <ErrorNotice error={errors[s.supplyId]} />
      </section>)}
    </div>
    {data && !rows.length && <p className="p-8 text-gray-500 text-center border rounded bg-white">Нет поставок по фильтру</p>}
  </div>;
};
