import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axiosInstance } from "../shared/api/axios";
import { endpoints } from "../shared/api/config";
import { useRestaurantContext } from "../features/restaurant-runtime/context";

type AnalyticsResponse = {
  restaurantId: string;
  totalOrders: number;
  completedOrders: number;
  acceptedSupplies: number;
  rejectedSupplies: number;
  spoiledUnits: number;
  confirmedWriteOffUnits: number;
  ordersByDay: { date: string; count: number }[];
};

export const AnalyticsPage = () => {
  const { restaurantId } = useRestaurantContext();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const from = new Date(Date.now() - days * 86400000).toISOString();
      const { data: response } = await axiosInstance.get<AnalyticsResponse>(endpoints.analytics(restaurantId), { params: { from }, signal });
      if (response.restaurantId !== restaurantId) throw new Error("Сервер вернул данные другого ресторана");
      setData(response);
    } catch (e: unknown) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Ошибка загрузки аналитики");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [restaurantId, days]);
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [load]);
  const cards = data ? [
    ["Всего заказов", data.totalOrders],
    ["Завершённых заказов", data.completedOrders],
    ["Принятых поставок", data.acceptedSupplies],
    ["Отклонённых поставок", data.rejectedSupplies],
    ["Найдено просроченных единиц", data.spoiledUnits],
    ["Подтверждено списаний", data.confirmedWriteOffUnits],
  ] as const : [];
  return <div className="space-y-6">
    <div className="flex items-center gap-4 justify-between flex-wrap">
      <div><h2 className="text-2xl font-bold">Аналитика</h2><p className="text-sm text-gray-500 mt-2">Заказы, поставки и списания из PostgreSQL. Без оценок выручки и прибыли.</p></div>
      <div className="flex items-center gap-3"><label className="text-sm">Период <select className="border rounded px-3 py-2 ml-2" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option></select></label><button className="bg-white border rounded px-4 py-2 text-sm" onClick={() => void load()}>Обновить</button></div>
    </div>
    {loading && <p className="text-sm text-gray-500">Загружаем данные…</p>}
    {error && <p role="alert" className="text-red-700 bg-red-50 border border-red-100 p-3 rounded">{error}</p>}
    {data && <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{cards.map(([title, value]) => <section key={title} className="rounded-lg bg-white border p-5"><p className="text-sm text-gray-500">{title}</p><p className="text-3xl font-bold mt-2">{value}</p></section>)}</div>
      <section className="bg-white border rounded-lg p-5"><h3 className="font-semibold mb-4">Заказы по дням</h3>{data.ordersByDay.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.ordersByDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" fontSize={11} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Заказы" fill="#2563eb" /></BarChart></ResponsiveContainer></div> : <p className="text-gray-500">За этот период заказов нет.</p>}</section>
    </>}
    <p className="text-xs text-gray-500">AnalStash хранит события в Redis. Для надёжности эти агрегаты рассчитываются из сохранённых записей PostgreSQL; денежные метрики появятся после добавления цен.</p>
  </div>;
};
