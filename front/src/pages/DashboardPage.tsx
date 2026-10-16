import { lazy, Suspense } from "react";
const OrderHistoryChart = lazy(() => import("./OrderHistoryChart"));
import { useDashboard } from "../features/restaurant-runtime/hooks";
import { SnapshotStatus } from "../shared/ui/Feedback";
import { dateLabel } from "../shared/lib/format";
export const DashboardPage = () => {
  const data = useDashboard();
  const metrics = data
    ? [
        ["Типов продуктов на складе", data.metrics.productTypes],
        ["Скоро истекают партии", data.metrics.expiringBatches],
        ["Просроченных партий", data.metrics.expiredBatches],
        ["Блюд в стоп-листе", data.metrics.stoppedDishes],
        ["Ожидающих поставок", data.metrics.pendingSupplies],
        ["Подтверждённых заказов", data.metrics.completedOrders],
      ]
    : [];
  return (
    <div>
      <h2 className="text-2xl font-bold mb-5">Дашборд</h2>
      <SnapshotStatus />
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {metrics.map(([name, count]) => (
              <div key={name} className="bg-white p-5 rounded border">
                <h3 className="text-sm text-gray-500">{name}</h3>
                <p className="text-3xl font-bold mt-2">{count}</p>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            <section className="bg-white border rounded p-5">
              <h3 className="text-lg font-semibold mb-4">Стоп-лист</h3>
              {!data.stopList.length && (
                <p className="text-gray-500 text-sm">Все блюда доступны.</p>
              )}
              {data.stopList.map((d) => (
                <div key={d.dishId} className="bg-red-50 p-3 rounded mb-3">
                  <p className="font-medium">{d.name}</p>
                  {d.shortages.map((i) => (
                    <p key={i.productId} className="text-sm mt-1">
                      {i.productName}: нужно {i.required}, пригодно{" "}
                      {i.available}, просрочено {i.expired}.
                    </p>
                  ))}
                </div>
              ))}
            </section>
            <section className="bg-white border rounded p-5">
              <h3 className="text-lg font-semibold mb-4">
                Рекомендации по блюдам
              </h3>
              {!data.recommendations.length && (
                <p className="text-gray-500 text-sm">
                  Сейчас нет доступных блюд с партиями, которые скоро истекают.
                </p>
              )}
              {data.recommendations.map((d, index) => (
                <div key={d.dishId} className="bg-orange-50 p-3 rounded mb-3">
                  <p className="font-medium">
                    {index + 1}. {d.name}
                  </p>
                  <p className="text-sm mt-1">{d.reason}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Доступно порций: {d.availablePortions}. Приоритет сервера:{" "}
                    {d.score}.
                  </p>
                </div>
              ))}
            </section>
            <section className="bg-white border rounded p-5">
              <h3 className="text-lg font-semibold mb-4">
                Потребность в закупках
              </h3>
              {!data.procurement.length && (
                <p className="text-gray-500 text-sm">
                  Пороги закупок в текущем бэкенде ещё не настроены.
                </p>
              )}
              {data.procurement.map((p) => (
                <p className="text-sm mb-2" key={p.productId}>
                  {p.productName}: пригодно {p.available}, минимум {p.target};
                  рекомендовано заказать {p.suggested}.
                </p>
              ))}
              <p className="text-xs text-gray-400 mt-3">
                Пороги задаёт сервер. Прогноз спроса потребует накопленной
                истории.
              </p>
            </section>
            <section className="bg-white border rounded p-5">
              <h3 className="text-lg font-semibold mb-4">Заказы по дням</h3>
              {data.orderHistory.length ? (
                <Suspense
                  fallback={
                    <p className="text-gray-500 text-sm">Загрузка графика…</p>
                  }
                >
                  <OrderHistoryChart data={data.orderHistory} />
                </Suspense>
              ) : (
                <p className="text-gray-500 text-sm">
                  История появится после первого подтверждённого заказа.
                </p>
              )}
            </section>
          </div>
          <section className="bg-white border rounded p-5 mt-5">
            <h3 className="text-lg font-semibold mb-4">Последние заказы</h3>
            {!data.recentOrders.length && (
              <p className="text-gray-500 text-sm">
                Подтверждённых заказов пока нет.
              </p>
            )}
            {data.recentOrders.map((o) => (
              <div key={o.orderId} className="border-t py-3">
                <p className="text-sm">
                  {dateLabel(o.createdAt)} ·{" "}
                  {o.items.map((i) => i.name + " × " + i.quantity).join(", ")}
                </p>
                {o.allocations && (
                  <p className="text-xs text-gray-500 mt-1">
                    Списания по партиям:{" "}
                    {o.allocations
                      .map(
                        (a) => a.batchId.slice(0, 8) + " (" + a.quantity + ")",
                      )
                      .join(", ")}
                  </p>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
};
