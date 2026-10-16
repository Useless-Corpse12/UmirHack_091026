import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, LogOut, Radio, LayoutDashboard, Boxes, Truck, ChartNoAxesCombined, UsersRound, Settings2, BookOpen, ChefHat, ArrowUpRight, CircleHelp, PackageCheck, ClipboardList, Clock3 } from "lucide-react";
import { Heading, Notice, Stat, Empty, surface, field, primary } from "./NativeUI";
import { useRestaurantContext } from "../../features/restaurant-runtime/context";
import { authApi } from "../../shared/api/authApi";
import { nativeBackendApi as api } from "../../shared/api/nativeBackendApi";
import type { Employee } from "../../shared/types/models";
import { toApiError } from "../../shared/api/errors";
import { NativeSignalR } from "../../shared/realtime/nativeSignalR";
import { CreateTerminalForm } from "./NativeTerminalsPage";
import { useNativeLiveStore } from "../../shared/realtime/nativeLiveStore";

const inputClass = field;
const primaryClass = primary;
const cardClass = `${surface} p-5 md:p-6 space-y-4`;

function Err({ error }: { error: string }) {
  return error ? <p role="alert" className="text-red-700 text-sm p-3 rounded bg-red-50 border border-red-200">{error}</p> : null;
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
  const pendingCount = useNativeLiveStore((s) => s.restaurantId === restaurantId ? s.supplies?.length || 0 : 0);
  useEffect(() => {
    selectRestaurant(restaurantId);
    const conn = new NativeSignalR(restaurantId, (event) => receive(restaurantId, event), (status, reason) => updateStatus(restaurantId, status, reason));
    void conn.start();
    return () => conn.stop();
  }, [restaurantId, selectRestaurant, receive, updateStatus]);
  const tabs = [
    { label: "Обзор", to: "dashboard", icon: LayoutDashboard },
    { label: "Аналитика", to: "analytics", icon: ChartNoAxesCombined },
    { label: "Склад", to: "warehouse", icon: Boxes },
    { label: "Приёмка", to: "deliveries", icon: Truck },
    ...(["owner", "admin"].includes(role) ? [{ label: "Сотрудники", to: "employees", icon: UsersRound }] : []),
    ...(["owner", "admin"].includes(role) ? [{ label: "Редактор меню", to: "menu", icon: BookOpen }] : []),
    ...(role === "owner" ? [{ label: "Настройки", to: "settings", icon: Settings2 }] : []),
  ];
  return <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
    <header className="border-b border-slate-200 bg-white px-4 py-5 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-100"><ChefHat size={25}/></div>
          <div><Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"><ArrowLeft size={14}/> Все рестораны</Link>
            <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-slate-900">{name}</h1><p className="mt-0.5 text-xs text-slate-500">Кабинет ресторана · {role}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3"><span role="status" className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${realtimeStatus === "connected" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-amber-100 bg-amber-50 text-amber-700"}`}><Radio size={15}/> {realtimeStatus === "connected" ? "SignalR на связи" : realtimeStatus === "connecting" ? "Подключение…" : realtimeStatus === "reconnecting" ? "Переподключение…" : "Нет real-time"}</span>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" onClick={() => { void authApi.logout(); navigate("/login"); }}><LogOut size={16}/> Выйти</button>
        </div>
      </div>
    </header>
    <nav className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/30 backdrop-blur"><div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 md:px-8">
      {tabs.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} className={({ isActive }) =>
        "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm transition " + (isActive ? "bg-indigo-50 font-extrabold text-indigo-700" : "font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800")}><Icon size={16}/>{label}{label === "Приёмка" && pendingCount > 0 && <span aria-label={`${pendingCount} новых поставок`} className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white">{pendingCount}</span>}</NavLink>)}
    </div></nav>
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-7 md:px-8 md:py-9">
      {realtimeError && <p role="status" className="text-xs text-rose-600">Соединение SignalR: {realtimeError}</p>}
      <Outlet key={restaurantId}/>
    </main>
  </div>;
}

const loadMenu = (id: string, signal: AbortSignal) => api.menu(id, signal);
const loadMembers = (id: string, signal: AbortSignal) => api.members(id, signal);

export function NativeDashboardPage() {
  const { name, role, restaurantId } = useRestaurantContext();
  const dishes = useRemote(loadMenu);
  const people = useRemote(loadMembers);
  const live = useNativeLiveStore((s) => s.restaurantId === restaurantId ? s : null);
  const totalStock = live?.products?.reduce((sum, item) => sum + item.quantity, 0);
  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-[#1d2566] via-[#373c96] to-[#5c45bc] p-6 text-white shadow-xl shadow-indigo-100 md:p-9">
      <div className="absolute -right-8 -top-10 h-56 w-56 rounded-full border-[45px] border-white/5" aria-hidden="true"/>
      <div className="relative"><p className="mb-2 text-xs font-extrabold uppercase tracking-[.18em] text-indigo-200">Ваш ресторан · UMIR</p>
        <h2 className="text-2xl font-extrabold tracking-tight md:text-4xl">Добро пожаловать в {name}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">Меню, команда, склад и поставки в одном кабинете. Здесь только подтверждённые данные из API и события SignalR.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link to="../warehouse" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-800 shadow-sm">Смотреть склад <ArrowUpRight size={16}/></Link>
          {["owner", "admin"].includes(role) && <Link to="../menu" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20">Редактор меню <BookOpen size={16}/></Link>}
        </div>
      </div>
    </section>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Блюда в меню" value={dishes.loading ? "…" : dishes.value?.length ?? "—"} icon={<ChefHat size={21}/>} description="Загружено из текущего POS/menu"/>
      <Stat label="Сотрудники" value={people.loading ? "…" : people.value?.length ?? "—"} icon={<UsersRound size={21}/>} description="Участники ресторана"/>
      <Stat label="Доступные партии" value={live?.products?.length ?? "—"} icon={<Boxes size={21}/>} description="Последнее событие ProductsUpdated"/>
      <Stat label="Общий остаток" value={totalStock ?? "—"} icon={<PackageCheck size={21}/>} description="Сумма количеств, только если пришла рассылка"/>
    </div>
    <div className="grid gap-5">
      <section className={`${surface} p-6`}><h3 className="mb-4 text-lg font-bold text-slate-900">Быстрые действия</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[{ to: "../warehouse", label: "Склад онлайн", sub: "Партии и стоп-лист", Icon: Boxes }, { to: "../analytics", label: "Аналитика", sub: "События AnalStash", Icon: ChartNoAxesCombined }, ...(["owner", "admin"].includes(role) ? [{ to: "../employees", label: "Команда", sub: "Сотрудники и инвайты", Icon: UsersRound }] : [])].map((a) =>
            <Link key={a.to} to={a.to} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50"><div className="rounded-xl bg-white p-2.5 text-indigo-600 shadow-sm"><a.Icon size={20}/></div><div className="flex-1"><p className="text-sm font-bold text-slate-900">{a.label}</p><p className="text-xs text-slate-500">{a.sub}</p></div><ArrowUpRight size={16} className="text-slate-400 group-hover:text-indigo-600"/></Link>)}
        </div>
      </section>
      <Err error={dishes.error || people.error}/>
    </div>
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
    <Heading eyebrow="Команда" title="Сотрудники" description="Участники ресторана, роли и приглашения для новых сотрудников."/>
    <Err error={error || data.error}/>{result && <Notice tone="success">{result}</Notice>}
    <div className={cardClass}>
      <div className="flex justify-between"><h3 className="font-semibold">Список сотрудников</h3><button className="text-blue-700 text-sm" onClick={() => void data.reload().catch(() => {})}>Обновить</button></div>
      {data.loading && <p>Загрузка…</p>}
      {data.value?.map((member) => <div key={member.userId} className="flex items-center gap-3 justify-between border-t py-3">
        <div><p className="break-all">{member.email}</p><p className="text-gray-500 text-sm">{member.role}</p></div>
        {member.role !== "owner" && (role === "owner" || (role === "admin" && ["manager", "cashier"].includes(member.role))) &&
          <button type="button" disabled={busy} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50" onClick={() => void remove(member)}>Удалить</button>}
      </div>)}
    </div>
    <form className={cardClass} onSubmit={(e) => void submitInvite(e)}>
      <h3 className="text-lg font-extrabold text-slate-900">Пригласить сотрудника</h3>
      <label className="block text-sm font-semibold text-slate-700">Email сотрудника<input type="email" required className={`${inputClass} mt-2`} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {role === "owner" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)}/>Администратор (иначе менеджер)</label>}
      <button disabled={busy} className={primaryClass}>{busy ? "Отправка…" : "Отправить приглашение"}</button>
    </form>
    <CreateTerminalForm/>
  </div>;
}

export function NativeWarehousePage() {
  const rest = useRestaurantContext();
  const live = useNativeLiveStore();
  const active = live.restaurantId === rest.restaurantId;
  const products = active ? live.products : null;
  const stops = active ? live.stops : null;
  const suggestions = active ? live.recommendations : null;
  const [stockView, setStockView] = useState<"products" | "batches">("products");
  const total = products?.reduce((sum, p) => sum + p.quantity, 0);
  // A product can have many FoodStock rows with different deliveries / expiry dates.
  // Aggregate only in the summary mode; never mutate the actual batch data.
  const summary = Object.values((products ?? []).reduce<Record<string, { id: string; name: string; quantity: number; batches: number }>>((acc, batch) => {
    const id = batch.productId || batch.productName;
    if (!acc[id]) acc[id] = { id, name: batch.productName, quantity: 0, batches: 0 };
    acc[id].quantity += batch.quantity;
    acc[id].batches += 1;
    return acc;
  }, {}));
  return <div className="space-y-6">
    <Heading eyebrow="Остатки · SignalR" title="Склад онлайн" description="Актуальные партии, стоп-листы и рекомендации, полученные через серверную рассылку."/>
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Количество в партиях" value={total ?? "—"} icon={<Boxes size={22}/>} description="Сумма по последней рассылке"/>
      <Stat label="Активных партий" value={products?.length ?? "—"} icon={<PackageCheck size={22}/>} description="ProductsUpdated"/>
      <Stat label="Позиций в стоп-листе" value={stops?.length ?? "—"} icon={<AlertTriangle size={22}/>} description="StopListUpdated"/>
    </div>
    <section className={`${surface} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 md:px-6"><div><h3 className="text-lg font-extrabold text-slate-900">Склад</h3><p className="mt-1 text-xs text-slate-500">Продукты и отдельные позиции FoodStock</p></div>
        <div role="group" aria-label="Вид склада" className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button type="button" aria-pressed={stockView === "products"} onClick={() => setStockView("products")} className={`rounded-lg px-3 py-2 transition ${stockView === "products" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>По продуктам</button>
          <button type="button" aria-pressed={stockView === "batches"} onClick={() => setStockView("batches")} className={`rounded-lg px-3 py-2 transition ${stockView === "batches" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>По поставкам · FoodStock</button>
        </div></div>
      <div className="p-5 md:p-6">{products === null ? <Empty title="Ждём обновления склада">Как только сервер отправит ProductsUpdated, партии появятся здесь.</Empty> : products.length === 0 ? <Empty title="Список партий пуст">Последняя рассылка содержит пустой склад.</Empty> :
        <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Продукт</th><th className="px-4 py-3">Количество</th>{stockView === "batches" ? <><th className="px-4 py-3">Годен до</th><th className="px-4 py-3">Поставка</th><th className="px-4 py-3">FoodStock ID</th></> : <th className="px-4 py-3">Партий</th>}</tr></thead><tbody>{stockView === "products" ? summary.map((item) => <tr key={item.id} className="border-t border-slate-100 hover:bg-indigo-50/40"><td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td><td className="px-4 py-3"><span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700">{item.quantity}</span></td><td className="px-4 py-3 text-slate-500">{item.batches}</td></tr>) : products.map((item, index) => <tr key={item.foodStockId || item.id || `${item.supplyId}-${item.productId}-${index}`} className="border-t border-slate-100 hover:bg-indigo-50/40"><td className="px-4 py-3 font-semibold text-slate-800">{item.productName}</td><td className="px-4 py-3"><span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700">{item.quantity}</span></td><td className="px-4 py-3 text-slate-600">{Number.isFinite(new Date(item.expiresAt).getTime()) ? new Date(item.expiresAt).toLocaleString("ru-RU") : "—"}</td><td title={item.supplyId} className="max-w-40 truncate px-4 py-3 font-mono text-xs text-slate-400">{item.supplyId}</td><td title={item.foodStockId || item.id || ""} className="max-w-40 truncate px-4 py-3 font-mono text-xs text-slate-400">{item.foodStockId || item.id || "—"}</td></tr>)}</tbody></table></div>}
      </div>
    </section>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={`${surface} p-5 md:p-6`}><h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold"><AlertTriangle className="text-amber-500" size={20}/> Стоп-лист</h3>
        {stops === null ? <Empty title="Стоп-лист пока не загружен">Данные появятся после обновления сервера.</Empty> : !stops.length ? <Empty title="Стоп-лист пуст">Ограничений по блюдам нет.</Empty> : <div className="space-y-2">{stops.map((id) => <div key={id} className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"><AlertTriangle size={17} className="mt-0.5 shrink-0"/><span className="min-w-0 break-all">Блюдо: {id}</span></div>)}</div>}
      </section>
      <section className={`${surface} p-5 md:p-6`}><h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold"><CircleHelp className="text-indigo-500" size={20}/> Рекомендации</h3>
        {suggestions === null ? <Empty title="Нет первого обновления">Ожидание RecommendationsUpdated.</Empty> : !suggestions.length ? <Empty title="Рекомендаций пока нет">Сервер не прислал рекомендаций в последнем событии.</Empty> : <div className="space-y-2">{suggestions.map((value, index) => {
          const obj = value && typeof value === "object" ? value as Record<string, unknown> : {};
          const title = [obj.title, obj.productName, obj.name, obj.message, obj.reason].find((s) => typeof s === "string" && s.trim());
          return <details key={index} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5"><summary className="cursor-pointer text-sm font-semibold text-slate-800">{typeof title === "string" ? title : `Рекомендация №${index + 1}`}</summary><pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 pt-3 text-xs text-slate-500">{JSON.stringify(value, null, 2)}</pre></details>;
        })}</div>}
      </section>
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
  const groups: { label: string; data: unknown[] | undefined; icon: typeof ChartNoAxesCombined }[] = [
    { label: "Заказы", data: live?.orders, icon: ClipboardList },
    { label: "Поставки", data: live?.supplies, icon: Truck },
    { label: "Порча и списания", data: live?.rot, icon: AlertTriangle },
  ];
  return <div className="space-y-6">
    <Heading eyebrow="События · AnalStash" title="Аналитика ресторана" description="История операций по данным последнего события AnalyticsUpdated из серверного Redis." aside={last && live ? <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500"><Clock3 size={15}/> {new Date(last).toLocaleString("ru-RU")}</span> : null}/>
    <div className="grid gap-4 sm:grid-cols-3">{groups.map(({ label, data, icon: Icon }) => <Stat key={label} label={label} value={data?.length ?? "—"} icon={<Icon size={22}/>} description={live ? "Событий в последней рассылке" : "Нет первого события"}/>)}</div>
    <div className="grid gap-5 lg:grid-cols-3">{groups.map(({ label, data, icon: Icon }) => <section key={label} className={`${surface} min-w-0 overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><Icon className="text-indigo-600" size={18}/><h3 className="font-extrabold text-slate-800">{label}</h3></div>
      <div className="max-h-96 space-y-2 overflow-y-auto p-4">{!data ? <Empty title="Нет данных">Ожидание события SignalR.</Empty> : data.length === 0 ? <Empty title="Событий пока нет">В этой рассылке записей нет.</Empty> : data.slice(-30).reverse().map((item, index) => <div key={index} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-sm"><p className="break-words font-semibold text-slate-800">{eventDescription(item)}</p><p className="mt-1 text-xs text-slate-500">{eventDate(item)}</p></div>)}</div>
    </section>)}</div>
  </div>;
}
