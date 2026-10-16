import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useRestaurantContext } from "../../features/restaurant-runtime/context";
import { authApi } from "../../shared/api/authApi";
import { nativeBackendApi as api, isGuid } from "../../shared/api/nativeBackendApi";
import type { NativeDish, NativeProductTemplate } from "../../shared/api/nativeBackendApi";
import type { Employee } from "../../shared/types/models";
import { toApiError } from "../../shared/api/errors";
import { NativeSignalR } from "../../shared/realtime/nativeSignalR";
import { useNativeLiveStore } from "../../shared/realtime/nativeLiveStore";

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white";
const primaryClass = "px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50";
const cardClass = "bg-white border border-gray-200 rounded-xl p-5 space-y-3";

function Err({ error }: { error: string }) {
  return error ? <p role="alert" className="text-red-700 text-sm p-3 rounded bg-red-50 border border-red-200">{error}</p> : null;
}
function Info({ children }: { children: ReactNode }) {
  return <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900">{children}</p>;
}
const messageOf = (reason: unknown) => toApiError(reason).message;

function useRemote<T>(reader: (id: string, signal: AbortSignal) => Promise<T>) {
  const { restaurantId } = useRestaurantContext();
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const result = await reader(restaurantId, signal || new AbortController().signal);
      if (!signal?.aborted) setValue(result);
      return result;
    } catch (e) {
      if (!signal?.aborted) setError(messageOf(e));
      throw e;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [restaurantId, reader]);
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [reload]);
  return { value, loading, error, reload };
}

export function NativeRestaurantLayout() {
  const { restaurantId, name, role } = useRestaurantContext();
  const navigate = useNavigate();
  const selectRestaurant = useNativeLiveStore((s) => s.selectRestaurant);
  const updateStatus = useNativeLiveStore((s) => s.updateStatus);
  const receive = useNativeLiveStore((s) => s.receive);
  const realtimeStatus = useNativeLiveStore((s) => s.status);
  const realtimeError = useNativeLiveStore((s) => s.error);
  useEffect(() => {
    selectRestaurant(restaurantId);
    const conn = new NativeSignalR(restaurantId, receive, updateStatus);
    void conn.start();
    return () => conn.stop();
  }, [restaurantId, selectRestaurant, receive, updateStatus]);
  const tabs = [
    { label: "Обзор", to: "dashboard" },
    { label: "Меню и продукты", to: "menu" },
    { label: "Склад", to: "warehouse" },
    { label: "Поставки", to: "deliveries" },
    { label: "Аналитика", to: "analytics" },
    ...(["owner", "admin"].includes(role) ? [{ label: "Сотрудники", to: "employees" }, { label: "Кассовые аппараты", to: "terminals" }] : []),
    ...(role === "owner" ? [{ label: "Настройки", to: "settings" }] : []),
  ];
  return <div className="min-h-screen bg-gray-50">
    <header className="bg-white border-b px-4 md:px-8 py-5">
      <div className="max-w-6xl mx-auto flex items-start justify-between gap-5">
        <div>
          <Link to="/" className="text-sm text-blue-700">← Мои рестораны</Link>
          <h1 className="text-2xl font-bold mt-2">{name}</h1>
          <p className="text-xs text-gray-500 mt-1">ID: {restaurantId} · Роль: {role}</p>
          <p role="status" className="text-xs mt-1 text-gray-600">SignalR: {realtimeStatus === "connected" ? "подключён (Long Polling)" : realtimeStatus === "connecting" ? "подключение…" : realtimeStatus === "reconnecting" ? "повторное подключение…" : "не подключён"}{realtimeError ? ` · ${realtimeError}` : ""}</p>
        </div>
        <button className="text-sm text-red-600" onClick={() => { void authApi.logout(); navigate("/login"); }}>Выйти</button>
      </div>
    </header>
    <nav className="bg-white border-b"><div className="max-w-6xl mx-auto px-4 md:px-8 flex gap-5 overflow-x-auto">
      {tabs.map((tab) => <NavLink key={tab.to} to={tab.to} className={({ isActive }) =>
        "text-sm py-4 whitespace-nowrap border-b-2 " + (isActive ? "border-blue-600 text-blue-700 font-semibold" : "border-transparent text-gray-600")}>{tab.label}</NavLink>)}
    </div></nav>
    <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <Outlet key={restaurantId} />
    </main>
  </div>;
}

const loadMenu = (id: string, signal: AbortSignal) => api.menu(id, signal);
const loadMembers = (id: string, signal: AbortSignal) => api.members(id, signal);

export function NativeDashboardPage() {
  const { name, role } = useRestaurantContext();
  const dishes = useRemote(loadMenu);
  const people = useRemote(loadMembers);
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-semibold">Обзор: {name}</h2><p className="text-gray-500 text-sm">Данные только из существующих методов бэкенда.</p></div>
    <div className="grid sm:grid-cols-2 gap-4">
      <section className={cardClass}><h3 className="text-sm text-gray-500">Блюд в Redis-меню</h3><p className="text-3xl font-bold">{dishes.loading ? "…" : dishes.value?.length ?? "—"}</p><Err error={dishes.error}/></section>
      <section className={cardClass}><h3 className="text-sm text-gray-500">Сотрудников в ресторане</h3><p className="text-3xl font-bold">{people.loading ? "…" : people.value?.length ?? "—"}</p><Err error={people.error}/></section>
    </div>
    <Info>В исходном API нет методов получения сводки склада, количества заказов, выручки и просрочки. Здесь намеренно не показываются нули или придуманные значения.</Info>
    <div className="flex gap-4 flex-wrap"><Link className="text-blue-700 underline" to="../menu">Открыть меню</Link>{["owner", "admin"].includes(role) && <Link className="text-blue-700 underline" to="../employees">Управление сотрудниками</Link>}</div>
  </div>;
}

export function NativeEmployeesPage() {
  const { restaurantId, role } = useRestaurantContext();
  const data = useRemote(loadMembers);
  const [email, setEmail] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const submitInvite = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setResult(""); setBusy(true);
    try {
      await api.invite(restaurantId, email.trim().toLowerCase(), role === "owner" && asAdmin ? "admin" : "manager");
      setResult("Приглашение отправлено. Получатель может ввести код на странице «Мои рестораны» → «Присоединиться по коду».");
      setEmail("");
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  const remove = async (person: Employee) => {
    if (!window.confirm(`Удалить ${person.email} из ресторана?`)) return;
    setBusy(true); setError(""); setResult("");
    try { await api.removeMember(restaurantId, person.userId); await data.reload(); setResult("Сотрудник удалён."); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <h2 className="text-2xl font-semibold">Сотрудники</h2>
    <Err error={error || data.error}/>{result && <p role="status" className="text-green-700">{result}</p>}
    <div className={cardClass}>
      <div className="flex justify-between"><h3 className="font-semibold">Список сотрудников</h3><button className="text-blue-700 text-sm" onClick={() => void data.reload().catch(() => {})}>Обновить</button></div>
      {data.loading && <p>Загрузка…</p>}
      {data.value?.map((member) => <div key={member.userId} className="flex items-center gap-3 justify-between border-t py-3">
        <div><p className="break-all">{member.email}</p><p className="text-gray-500 text-sm">{member.role}</p></div>
        {member.role !== "owner" && (role === "owner" || (role === "admin" && ["manager", "cashier"].includes(member.role))) &&
          <button type="button" disabled={busy} className="text-red-700 text-sm disabled:opacity-50" onClick={() => void remove(member)}>Удалить</button>}
      </div>)}
    </div>
    <form className={cardClass} onSubmit={(e) => void submitInvite(e)}>
      <h3 className="font-semibold">Отправить приглашение</h3>
      <Info>После получения письма сотрудник входит в свой аккаунт и вводит код приглашения. Он будет отправлен в <code>Authority/AcceptInvite</code>.</Info>
      <label className="block text-sm">Email<input type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {role === "owner" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)}/>Администратор (иначе менеджер)</label>}
      <button disabled={busy} className={primaryClass}>{busy ? "Отправка…" : "Отправить письмо"}</button>
    </form>
  </div>;
}

export function NativeMenuPage() {
  const { restaurantId, role } = useRestaurantContext();
  const list = useRemote(loadMenu);
  const [raw, setRaw] = useState('{\n  "Борщ": { "Картофель": 2, "Свёкла": 1 }\n}');
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const replace = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (confirmation !== "ЗАМЕНИТЬ") { setError("Введите ЗАМЕНИТЬ для подтверждения"); return; }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("Нужен JSON-объект блюд");
      const menu = parsed as Record<string, unknown>;
      if (!Object.keys(menu).length) throw Error("Меню не может быть пустым");
      for (const [dish, recipe] of Object.entries(menu)) {
        if (!dish.trim() || !recipe || typeof recipe !== "object" || Array.isArray(recipe)) throw Error("Неверный рецепт блюда " + dish);
        const ingredients = Object.entries(recipe);
        if (!ingredients.length || ingredients.some(([name, qty]) => !name.trim() || !Number.isInteger(qty) || (qty as number) <= 0))
          throw Error("Укажите положительные целые количества ингредиентов для " + dish);
      }
      setBusy(true);
      await api.replaceMenu(restaurantId, menu as Record<string, Record<string, number>>);
      setSuccess("Полное меню заменено на сервере."); setConfirmation("");
      await list.reload();
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <h2 className="text-2xl font-semibold">Меню ресторана</h2>
    <section className={cardClass}>
      <div className="flex justify-between"><h3 className="font-semibold">Блюда (из Redis через GET /api/POS/menu)</h3><button className="text-sm text-blue-700" onClick={() => void list.reload().catch(() => {})}>Обновить</button></div>
      <Err error={list.error}/>{list.loading && <p>Загрузка…</p>}
      {list.value?.length === 0 && <p className="text-gray-500">Меню пусто</p>}
      {list.value?.map((dish: NativeDish) => <p className="py-2 border-t" key={dish.dishId}>{dish.name}</p>)}
      <p className="text-xs text-gray-500">Сервер отдаёт названия и ID, но не возвращает состав рецептов.</p>
    </section>
    {(["owner", "admin"].includes(role)) && <form className={cardClass} onSubmit={(e) => void replace(e)}>
      <h3 className="font-semibold">Полная замена меню (дополнительно)</h3>
      <Info><strong>Опасно:</strong> <code>LoadRestaurantMenu</code> удаляет ВСЕ старые блюда и создаёт новые ID. Это не операция «добавить блюдо». Используй только если у тебя полный JSON всего меню и всех рецептов.</Info>
      <label className="block text-sm">JSON: название блюда → название продукта → целое количество<textarea className={inputClass + " font-mono text-sm mt-2"} rows={9} value={raw} onChange={(e) => setRaw(e.target.value)} /></label>
      <label className="block text-sm">Для подтверждения напиши <b>ЗАМЕНИТЬ</b><input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass}/></label>
      <Err error={error}/>{success && <p className="text-green-700" role="status">{success}</p>}
      <button disabled={busy || confirmation !== "ЗАМЕНИТЬ"} className="bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">{busy ? "Сохранение…" : "Заменить ВСЁ меню"}</button>
    </form>}
  </div>;
}

export function NativeProductsPage() {
  const { restaurantId, role } = useRestaurantContext();
  const [raw, setRaw] = useState('[\n  { "name": "Молоко", "shelfLifeSeconds": 86400, "unit": "л" }\n]');
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const save = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (confirmation !== "УДАЛИТЬ ВСЁ") { setError("Подтверди полную замену каталога"); return; }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 1000) throw Error("Нужен непустой массив JSON из максимум 1000 продуктов");
      for (const item of parsed) {
        if (!item || typeof item.name !== "string" || !item.name.trim() ||
            !Number.isInteger(item.shelfLifeSeconds) || item.shelfLifeSeconds <= 0 ||
            typeof item.unit !== "string" || !item.unit.trim())
          throw Error("Каждый продукт должен содержать name, положительный shelfLifeSeconds и unit");
      }
      const items = parsed as NativeProductTemplate[];
      const names = items.map((p) => p.name.trim().toLowerCase());
      if (new Set(names).size !== names.length) throw Error("В JSON повторяются названия продуктов");
      setBusy(true);
      await api.replaceCatalog(restaurantId, items);
      setSuccess("Команда полной замены каталога выполнена. Текущий каталог невозможно перечитать через пользовательский API.");
      setConfirmation("");
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <h2 className="text-2xl font-semibold">Продукты</h2>
    <Info><strong>Ограничение API:</strong> нет защищённого пользовательского метода получения каталога и метода добавления одного продукта. <code>SetProducts</code> сначала удаляет ВСЕ продукты и генерирует новые ID. Поэтому безопасное добавление, редактирование одного продукта и экспорт реального каталога недоступны. На экране нет выдуманного списка «молоко, хлеб, яйца».</Info>
    {(["owner", "admin"].includes(role)) && <form className={cardClass} onSubmit={(e) => void save(e)}>
      <h3 className="font-semibold">Опасная операция: полная замена каталога</h3>
      <p className="text-sm text-gray-600">Поле ниже — только пример формата, а не продукты из твоей базы. Подставь <b>весь</b> каталог. Бэкенд может отказать в удалении продуктов, если есть связи с поставками и рецептами.</p>
      <textarea rows={10} className={inputClass + " font-mono text-sm"} value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Полный каталог JSON" />
      <label className="block text-sm">Введи <b>УДАЛИТЬ ВСЁ</b>, если понимаешь последствия<input className={inputClass} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
      <Err error={error}/>{success && <p className="text-green-700" role="status">{success}</p>}
      <button disabled={busy || confirmation !== "УДАЛИТЬ ВСЁ"} className="bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50">{busy ? "Отправка…" : "Заменить весь каталог"}</button>
    </form>}
  </div>;
}

export function NativeDeliveriesPage() {
  const { restaurantId, role } = useRestaurantContext();
  const [supplyId, setSupplyId] = useState("");
  const [quantities, setQuantities] = useState('[]');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const decide = async (type: "accept" | "reject") => {
    setError(""); setSuccess("");
    try {
      if (!isGuid(supplyId.trim())) throw Error("Укажи корректный supplyId (UUID)");
      setBusy(true);
      if (type === "reject") {
        if (!window.confirm("Отклонить поставку?")) return;
        await api.rejectSupply(restaurantId, supplyId.trim());
      } else {
        const items: unknown = JSON.parse(quantities);
        if (!Array.isArray(items) || !items.length || items.some((p) => !p || !isGuid(p.productId) || !Number.isInteger(p.factQuantity) || p.factQuantity < 0))
          throw Error('Нужен непустой JSON-массив { "productId": "UUID", "factQuantity": 5 }');
        if (!window.confirm("Принять поставку с указанными фактическими количествами?")) return;
        await api.acceptSupply(supplyId.trim(), items);
      }
      setSuccess(type === "accept" ? "Поставка принята сервером." : "Поставка отклонена сервером.");
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5"><h2 className="text-2xl font-semibold">Поставки</h2>
    <Info>В Useless-Corpse API нет метода получения списка поставок. Но методы <code>AcceptSupply</code> и <code>RejectSupply</code> есть. Если известен ID поставки и ID её продуктов, ими можно воспользоваться без изменения бэкенда.</Info>
    {(["owner", "admin"].includes(role)) ? <section className={cardClass}>
      <label className="block text-sm">ID поставки (supplyId)<input className={inputClass} value={supplyId} onChange={(e) => setSupplyId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label>
      <label className="block text-sm">Фактически принятые позиции (JSON)<textarea rows={6} className={inputClass + " font-mono text-sm"} value={quantities} onChange={(e) => setQuantities(e.target.value)} placeholder='[{"productId":"...","factQuantity":5}]'/></label>
      <Err error={error}/>{success && <p role="status" className="text-green-700">{success}</p>}
      <div className="flex gap-3 flex-wrap"><button className={primaryClass} disabled={busy} onClick={() => void decide("accept")}>Принять</button>
        <button className="bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50" disabled={busy} onClick={() => void decide("reject")}>Отклонить</button></div>
    </section> : <p className="text-gray-600">Для решения о приёмке нужна роль владельца или администратора.</p>}
  </div>;
}

export function NativeWarehousePage() {
  const rest = useRestaurantContext();
  const live = useNativeLiveStore();
  const active = live.restaurantId === rest.restaurantId;
  const products = active ? live.products : null;
  const stops = active ? live.stops : null;
  const suggestions = active ? live.recommendations : null;
  const total = products?.reduce((v, p) => v + p.quantity, 0);
  return <div className="space-y-5"><h2 className="text-2xl font-semibold">Склад онлайн</h2>
    <p className="text-sm text-gray-500">Получает данные от существующего SignalR-хаба <code>/hubs/notifications</code>. Снимок появляется после серверной рассылки события, а не при первом подключении.</p>
    <div className="grid sm:grid-cols-3 gap-4">
      <div className={cardClass}><h3>Остаток в партиях</h3><p className="text-3xl font-bold">{total ?? "—"}</p></div>
      <div className={cardClass}><h3>Партий</h3><p className="text-3xl font-bold">{products?.length ?? "—"}</p></div>
      <div className={cardClass}><h3>Блюд в стоп-листе</h3><p className="text-3xl font-bold">{stops?.length ?? "—"}</p></div>
    </div>
    <div className={cardClass}><h3 className="font-semibold">Партии продуктов (ProductsUpdated)</h3>
      {products === null ? <Info>Ожидаем первое событие ProductsUpdated. Исходный API не предоставляет HTTP-метода чтения полного состояния.</Info> : products.length === 0 ? <p>В последней рассылке партии отсутствуют.</p> :
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Продукт</th><th className="p-2">Количество</th><th className="p-2">Годен до</th><th className="p-2">Поставка</th></tr></thead><tbody>{products.map((i, index) => <tr key={i.supplyId + i.productId + index} className="border-t"><td className="p-2">{i.productName}</td><td className="p-2">{i.quantity}</td><td className="p-2">{new Date(i.expiresAt).toLocaleString("ru-RU")}</td><td className="p-2 font-mono text-xs">{i.supplyId}</td></tr>)}</tbody></table></div>}
    </div>
    <div className="grid md:grid-cols-2 gap-4">
      <div className={cardClass}><h3 className="font-semibold">Стоп-лист (StopListUpdated)</h3>
        {stops === null ? <p className="text-sm text-gray-500">Нет рассылки</p> : stops.length ? stops.map((id) => <p key={id} className="border-t py-2 font-mono text-xs">Блюдо: {id}</p>) : <p className="text-sm">Стоп-лист пуст</p>}
      </div>
      <div className={cardClass}><h3 className="font-semibold">Рекомендации (RecommendationsUpdated)</h3>
        {suggestions === null ? <p className="text-sm text-gray-500">Нет рассылки</p> : suggestions.length ? suggestions.map((item, idx) => <pre key={idx} className="text-xs whitespace-pre-wrap border-t pt-2">{JSON.stringify(item, null, 2)}</pre>) : <p className="text-sm">Рекомендаций нет</p>}
      </div>
    </div>
  </div>;
}

function eventDate(item: unknown): string {
  if (!item || typeof item !== "object") return "—";
  const v = item as Record<string, unknown>;
  const value = v.createdAt || v.date || v.approvedAt;
  if (typeof value !== "string") return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU");
}
function eventDescription(item: unknown): string {
  if (!item || typeof item !== "object") return String(item);
  const v = item as Record<string, unknown>;
  const id = v.id || v.supplyNumber || v.orderId || v.supplyId;
  const count = v.itemsCount ?? v.acceptedBatches ?? v.quantity;
  const status = v.status ?? "";
  return [id ? `№ ${String(id)}` : "Событие", count !== undefined ? `кол-во: ${count}` : "", status ? `статус: ${String(status)}` : ""].filter(Boolean).join(" · ");
}
export function NativeAnalyticsPage() {
  const { restaurantId } = useRestaurantContext();
  const live = useNativeLiveStore((s) => s.restaurantId === restaurantId ? s.analytics : null);
  const last = useNativeLiveStore((s) => s.restaurantId === restaurantId ? s.receivedAt : "");
  const groups: { label: string; data: unknown[] | undefined }[] = [
    { label: "Заказы", data: live?.orders },
    { label: "Поставки", data: live?.supplies },
    { label: "Порча / списания", data: live?.rot },
  ];
  return <div className="space-y-5"><h2 className="text-2xl font-semibold">Аналитика в реальном времени</h2>
    <p className="text-sm text-gray-500">События <code>AnalyticsUpdated</code> из серверного <code>AnalStash</code>. Содержимое Redis используется без выдуманных денежных показателей.</p>
    {live === null && <Info>Ожидаем первую рассылку AnalyticsUpdated. Сервер не отдаёт первичную историю аналитики по HTTP и не отправляет её автоматически при подключении.</Info>}
    <div className="grid sm:grid-cols-3 gap-4">
      {groups.map((g) => <section className={cardClass} key={g.label}><h3 className="text-gray-500 text-sm">{g.label}</h3><p className="text-3xl font-bold">{g.data?.length ?? "—"}</p></section>)}
    </div>
    {last && live && <p className="text-xs text-gray-500">Последняя рассылка: {new Date(last).toLocaleString("ru-RU")}</p>}
    {groups.map((g) => <section key={g.label} className={cardClass}><h3 className="font-semibold">{g.label} — последние события</h3>
      {g.data === undefined ? <p className="text-sm text-gray-500">Нет данных</p> : g.data.length === 0 ? <p className="text-sm">Событий нет</p> :
        <div className="max-h-80 overflow-y-auto">{g.data.slice(-30).reverse().map((item, i) => <div key={i} className="border-t py-3 text-sm"><p>{eventDescription(item)}</p><p className="text-xs text-gray-500">{eventDate(item)}</p></div>)}</div>}
    </section>)}
    <p className="text-xs text-gray-500">Выручка и прибыль не вычисляются: бэкенд не предоставляет корректные цены продаж.</p>
  </div>;
}
