import { useRef, useState } from "react";
import { useRestaurantContext } from "../restaurant-runtime/context";
import {
  useRestaurantRuntime,
  refreshRestaurant,
} from "../restaurant-runtime/runtimeStore";
import { useMutation } from "../../shared/lib/useMutation";
import { demoApi } from "../../shared/api/demoApi";
import { ErrorNotice } from "../../shared/ui/Feedback";
import { dateLabel } from "../../shared/lib/format";

export function DeveloperTools() {
  const { restaurantId } = useRestaurantContext();
  const data = useRestaurantRuntime((s) => s.data);
  const [productId, setProductId] = useState("");
  const [supplyQty, setSupplyQty] = useState("4");
  const [dishId, setDishId] = useState("");
  const [orderQty, setOrderQty] = useState("1");
  const [message, setMessage] = useState("");
  const attempt = useRef<{ key: string; signature: string } | null>(null);
  const supply = useMutation(demoApi.supply);
  const order = useMutation(demoApi.order);
  const time = useMutation(demoApi.advanceTime);
  const selectedProduct =
    data?.catalog.find((p) => p.productId === productId) || data?.catalog[0];
  const selectedDish =
    data?.menu.find((d) => d.dishId === dishId) || data?.menu[0];
  const makeSupply = async () => {
    if (!selectedProduct) return;
    setMessage("");
    try {
      await supply.run(restaurantId, [
        { productId: selectedProduct.productId, quantity: Number(supplyQty) },
      ]);
      setMessage(
        "Поставка поступила в ожидание. Примите её на вкладке «Поставки».",
      );
      await refreshRestaurant(true);
    } catch {
      /* The server explains the error. */
    }
  };
  const makeOrder = async () => {
    if (!selectedDish) return;
    const items = [{ dishId: selectedDish.dishId, quantity: Number(orderQty) }];
    const signature = JSON.stringify(items);
    if (!attempt.current || attempt.current.signature !== signature)
      attempt.current = { key: crypto.randomUUID(), signature };
    setMessage("");
    try {
      const result = await order.run(restaurantId, items, attempt.current.key);
      attempt.current = null;
      setMessage(
        "Заказ подтверждён: " +
          result.orderId +
          ". Склад, стоп-лист и рекомендации пересчитаны сервером.",
      );
      await refreshRestaurant(true);
    } catch {
      /* An uncertain retry keeps the same idempotency key. */
    }
  };
  const moveClock = async () => {
    setMessage("");
    try {
      await time.run(restaurantId, 24);
      setMessage("Часы всех деморесторанов сдвинуты на 24 часа.");
      await refreshRestaurant(true);
    } catch {
      /* Shown below. */
    }
  };
  return (
    <details className="mt-8 border border-dashed border-amber-400 bg-amber-50 rounded p-4">
      <summary className="cursor-pointer font-medium">
        Демо-инструменты: внешний поставщик и POS
      </summary>
      <p className="text-sm text-gray-600 my-3">
        Эта панель проверяет интеграцию B. В live её нет. Действия выполняет
        локальный HTTP-сервис, изменения приходят по WebSocket.
      </p>
      {data ? (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border rounded p-4 space-y-3">
            <h3 className="font-semibold">Поставка от поставщика</h3>
            <label className="block text-sm">
              Продукт
              <select
                aria-label="Продукт поставки"
                className="w-full border p-2 mt-1 rounded"
                value={selectedProduct?.productId || ""}
                onChange={(e) => setProductId(e.target.value)}
              >
                {data.catalog.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Количество
              <input
                aria-label="Количество поставки"
                type="number"
                min="0.001"
                step="0.001"
                value={supplyQty}
                onChange={(e) => setSupplyQty(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </label>
            <button
              disabled={
                supply.isLoading || !selectedProduct || !(Number(supplyQty) > 0)
              }
              onClick={() => void makeSupply()}
              className="bg-blue-600 text-white p-2 rounded disabled:opacity-50"
            >
              Отправить поставку
            </button>
            <ErrorNotice error={supply.error} />
          </div>
          <div className="bg-white border rounded p-4 space-y-3">
            <h3 className="font-semibold">Подтверждение заказа в POS</h3>
            <label className="block text-sm">
              Блюдо
              <select
                aria-label="Блюдо заказа"
                value={selectedDish?.dishId || ""}
                onChange={(e) => setDishId(e.target.value)}
                className="w-full border p-2 mt-1 rounded"
              >
                {data.menu.map((d) => (
                  <option key={d.dishId} value={d.dishId}>
                    {d.name} — доступно {d.availablePortions}
                  </option>
                ))}
              </select>
            </label>
            {!data.menu.length && (
              <p className="text-sm text-gray-500">
                Меню ещё не создано. Редактор рецептов относится к POS/бэкенду.
              </p>
            )}
            <label className="block text-sm">
              Порций
              <input
                aria-label="Порций заказа"
                type="number"
                min="1"
                step="1"
                value={orderQty}
                onChange={(e) => setOrderQty(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </label>
            <button
              disabled={
                order.isLoading || !selectedDish || !(Number(orderQty) > 0)
              }
              onClick={() => void makeOrder()}
              className="bg-green-600 text-white p-2 rounded disabled:opacity-50"
            >
              Подтвердить заказ POS
            </button>
            <ErrorNotice error={order.error} />
            {order.error?.details != null && (
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(order.error.details, null, 2)}
              </pre>
            )}
          </div>
          <div className="bg-white border rounded p-4 space-y-3">
            <h3 className="font-semibold">Истечение срока</h3>
            <p className="text-sm">{dateLabel(data.generatedAt)}</p>
            <p className="text-sm text-gray-600">
              Сдвигает часы склада на сутки; время JWT и подтверждения почты
              остаётся настоящим.
            </p>
            <button
              disabled={time.isLoading}
              onClick={() => void moveClock()}
              className="border p-2 rounded disabled:opacity-50"
            >
              Перемотать на 24 часа
            </button>
            <ErrorNotice error={time.error} />
          </div>
        </div>
      ) : (
        <p className="text-sm">Сначала загрузите данные ресторана.</p>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-green-800 break-words">
          {message}
        </p>
      )}
    </details>
  );
}
