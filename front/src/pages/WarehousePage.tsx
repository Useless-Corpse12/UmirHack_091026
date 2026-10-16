import { useState } from "react";
import {
  useWarehouse,
  useDashboard,
} from "../features/restaurant-runtime/hooks";
import { SnapshotStatus } from "../shared/ui/Feedback";
import { dateLabel, supplyLabel, unitLabel } from "../shared/lib/format";
import { aggregateWarehouse } from "../shared/lib/warehouse";
import { durationLabel } from "../shared/lib/shelfLife";
export const WarehousePage = () => {
  const batches = useWarehouse();
  const snapshot = useDashboard();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"batches" | "products">("batches");
  const productRows = aggregateWarehouse(
    batches || [],
    snapshot?.catalog || [],
  ).filter((p) =>
    p.productName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const units = new Map(snapshot?.catalog.map((p) => [p.productId, p.unit]));
  const quantityLabel = (quantity: number, unit = "") =>
    quantity.toLocaleString("ru-RU", { maximumFractionDigits: 3 }) +
    (unit ? " " + unitLabel(unit) : "");
  const rows = (batches || [])
    .filter(
      (b) =>
        b.productName.toLowerCase().includes(search.toLowerCase()) &&
        (status === "all" || b.expiryStatus === status),
    )
    .toSorted((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Склад</h2>
      <p className="text-sm text-gray-600 mb-5">
        Остатки по партиям или по продуктам. Просроченные продукты уже исключены
        из приготовления блюд.
      </p>
      <SnapshotStatus />
      {batches && (
        <>
          <div
            role="group"
            aria-label="Вид склада"
            className="flex gap-2 mb-4 flex-wrap"
          >
            {(
              [
                ["batches", "По партиям"],
                ["products", "По продуктам"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={
                  "px-4 py-2 rounded border " +
                  (view === value
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 hover:bg-gray-50")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 mb-5 flex-wrap">
            <input
              aria-label="Поиск по складу"
              placeholder="Название продукта"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded p-2 bg-white"
            />
            {view === "batches" && (
              <select
                aria-label="Статус срока годности"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="border rounded p-2 bg-white"
              >
                <option value="all">Все партии</option>
                <option value="fresh">Свежие</option>
                <option value="soon">Скоро истекает</option>
                <option value="expired">Просрочено</option>
              </select>
            )}
          </div>
          {view === "products" ? (
            <section aria-label="Остатки по продуктам">
              <p className="text-sm text-gray-600 mb-3">
                Всего на складе — пригодные и ещё не убранные просроченные
                остатки. Ближайший срок относится к пригодным партиям; показано,
                сколько истечёт в этот момент, если до этого не использовать
                продукт. Ожидающие поставки сюда не входят.
              </p>
              <div className="overflow-x-auto bg-white rounded border">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "Продукт",
                        "Всего на складе",
                        "Можно использовать",
                        "Уже просрочено",
                        "Ближайший срок",
                        "Истечёт в этот срок",
                      ].map((h) => (
                        <th key={h} className="p-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productRows.map((p) => (
                      <tr
                        key={p.productId}
                        data-testid="warehouse-product-row"
                        data-product-id={p.productId}
                        className="border-t"
                      >
                        <td className="p-4 font-medium">
                          {p.productName}
                          <p className="font-normal text-xs text-gray-500">
                            Партий: {p.batchCount}
                          </p>
                        </td>
                        <td
                          className="p-4 whitespace-nowrap"
                          data-testid="product-total"
                        >
                          {quantityLabel(p.totalQuantity, p.unit)}
                        </td>
                        <td
                          className="p-4 whitespace-nowrap"
                          data-testid="product-available"
                        >
                          {quantityLabel(p.availableQuantity, p.unit)}
                        </td>
                        <td
                          className={
                            "p-4 whitespace-nowrap " +
                            (p.expiredQuantity
                              ? "text-red-700 font-medium"
                              : "text-gray-500")
                          }
                          data-testid="product-expired"
                        >
                          {quantityLabel(p.expiredQuantity, p.unit)}
                        </td>
                        <td
                          className="p-4 whitespace-nowrap"
                          data-testid="product-next-expiry"
                        >
                          {p.nextExpiresAt ? (
                            <time dateTime={p.nextExpiresAt}>
                              {dateLabel(p.nextExpiresAt, true)}
                            </time>
                          ) : (
                            "Нет пригодных партий"
                          )}
                        </td>
                        <td
                          className="p-4 whitespace-nowrap"
                          data-testid="product-expiring"
                        >
                          {p.nextExpiresAt
                            ? quantityLabel(p.nextExpiryQuantity, p.unit)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!productRows.length && (
                  <p className="p-8 text-center text-gray-500">
                    Нет продуктов по выбранным условиям.
                  </p>
                )}
              </div>
            </section>
          ) : (
            <div className="overflow-x-auto bg-white rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    {[
                      "Продукт / партия",
                      "Количество",
                      "Получено",
                      "Годен до",
                      "Осталось",
                      "Статус",
                    ].map((h) => (
                      <th key={h} className="p-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr
                      key={b.batchId}
                      className={
                        "border-t " +
                        (b.expiryStatus === "expired"
                          ? "bg-red-50"
                          : b.expiryStatus === "soon"
                            ? "bg-orange-50"
                            : "")
                      }
                    >
                      <td className="p-4">
                        <p className="font-medium">{b.productName}</p>
                        <p className="text-xs text-gray-600">
                          Поставка {supplyLabel(b)}
                        </p>
                        <span
                          className="text-xs text-gray-500"
                          title={b.batchId}
                        >
                          {b.batchId.slice(0, 8)}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {quantityLabel(b.quantity, units.get(b.productId))}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {dateLabel(b.receivedAt)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {dateLabel(b.expiresAt, true)}
                      </td>
                      <td className="p-4">
                        {b.remainingHours <= 0
                          ? "Истёк"
                          : durationLabel(
                              Math.max(1, Math.ceil(b.remainingHours * 3600)),
                            )}
                      </td>
                      <td className="p-4">
                        {
                          {
                            fresh: "Свежая",
                            soon: "Скоро истекает",
                            expired: "Просрочена",
                          }[b.expiryStatus]
                        }
                        {b.expiryStatus === "expired" && (
                          <p className="text-xs text-red-700 mt-1">
                            Ждёт подтверждения менеджера
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="p-8 text-center text-gray-500">
                  Нет партий по выбранным условиям.
                </p>
              )}
            </div>
          )}
          <section
            aria-label="История подтверждённой просрочки"
            className="mt-6 bg-white rounded border border-gray-200 overflow-hidden"
          >
            <h3 className="font-semibold p-4 bg-gray-50">
              Подтверждённая просрочка
            </h3>
            {!snapshot?.expiryApprovals.length ? (
              <p className="p-5 text-sm text-gray-500">
                Подтверждений пока нет.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead>
                    <tr>
                      {[
                        "Продукт / партия",
                        "Поставка",
                        "Списано",
                        "Подтверждено",
                        "Менеджер",
                      ].map((h) => (
                        <th key={h} className="p-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.expiryApprovals
                      .filter((a) =>
                        a.productName
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((a) => (
                        <tr
                          data-testid="expiry-history-row"
                          key={a.approvalId}
                          className="border-t border-gray-200"
                        >
                          <td className="p-3">
                            <p className="font-medium">{a.productName}</p>
                            <p className="text-xs text-gray-500">
                              {a.batchId.slice(0, 8)}
                            </p>
                          </td>
                          <td className="p-3">{supplyLabel(a)}</td>
                          <td className="p-3">{a.quantity}</td>
                          <td className="p-3 whitespace-nowrap">
                            {dateLabel(a.approvedAt)}
                          </td>
                          <td className="p-3">
                            {a.approvedByEmail || a.approvedBy}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
