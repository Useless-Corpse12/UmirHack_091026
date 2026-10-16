import { useEffect, useMemo, useState } from "react";
import { CheckCheck, ClipboardCheck, PackageCheck, Truck, XCircle } from "lucide-react";
import { useRestaurantContext } from "../../features/restaurant-runtime/context";
import { nativeBackendApi as api, isGuid, type FactItem } from "../../shared/api/nativeBackendApi";
import { toApiError } from "../../shared/api/errors";
import { parseIncomingSupplies, type IncomingSupply } from "../../shared/realtime/incomingSupplies";
import { useNativeLiveStore } from "../../shared/realtime/nativeLiveStore";
import { Empty, Heading, Notice, field, primary, surface } from "./NativeUI";

const EMPTY_PROCESSED: string[] = [];
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const rejectButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50";
const integer = (raw: string): number | null => {
  if (!/^\d+$/.test(raw.trim())) return null;
  const num = Number(raw);
  return Number.isSafeInteger(num) ? num : null;
};
let rowIndex = 0;
const newRow = () => ({ key: ++rowIndex, productId: "", arrived: "", accepted: "" });
type ManualRow = ReturnType<typeof newRow>;

function SupplyActions({ busy, onReject, onAccept, onAll }: { busy: boolean; onReject: () => void; onAccept: () => void; onAll: () => void }) {
  return <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
    <button type="button" disabled={busy} onClick={onReject} className={rejectButton}><XCircle size={17}/> Отказ</button>
    <button type="button" disabled={busy} onClick={onAccept} className={primary}><PackageCheck size={17}/> {busy ? "Отправка…" : "Принять"}</button>
    <button type="button" disabled={busy} onClick={onAll} className={secondaryButton}><CheckCheck size={17}/> Принять всё</button>
  </div>;
}

/** Original backend has AcceptSupply/RejectSupply but no GET supplies.
 * The rich inbox is populated only when SignalR provides actual item-level incoming data.
 * An explicitly pending AnalyticsUpdated record is also usable when it includes items.
 * The manual UUID form stays as a fallback until backend publishes such data.
 */
export function NativeDeliveriesPage() {
  const { restaurantId, role } = useRestaurantContext();
  const suppliesEvent = useNativeLiveStore((s) => s.restaurantId === restaurantId ? s.supplies : null);
  const analytics = useNativeLiveStore((s) => s.restaurantId === restaurantId ? s.analytics : null);
  const processedByServer = useNativeLiveStore((s) => s.restaurantId === restaurantId ? s.processedSupplyIds : EMPTY_PROCESSED);
  const markSupplyProcessed = useNativeLiveStore((s) => s.markSupplyProcessed);
  const [fact, setFact] = useState<Record<string, Record<string, string>>>({});
  const [processed, setProcessed] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [manualId, setManualId] = useState("");
  const [manual, setManual] = useState<ManualRow[]>([newRow()]);
  useEffect(() => { setFact({}); setProcessed([]); setManualId(""); setManual([newRow()]); setError(""); setSuccess(""); }, [restaurantId]);

  const supplies = useMemo(() => {
    const fromHistory = parseIncomingSupplies(analytics?.supplies, true);
    const all = new Map<string, IncomingSupply>();
    for (const entry of fromHistory) all.set(entry.supplyId.toLowerCase(), entry);
    for (const entry of suppliesEvent || []) all.set(entry.supplyId.toLowerCase(), entry);
    return [...all.values()].filter((item) => !processed.includes(item.supplyId.toLowerCase()) && !processedByServer.includes(item.supplyId.toLowerCase())).reverse();
  }, [analytics?.supplies, suppliesEvent, processed, processedByServer]);

  const submit = async (supply: IncomingSupply, action: "reject" | "accept" | "all") => {
    setError(""); setSuccess("");
    try {
      const items: FactItem[] = [];
      if (action !== "reject") {
        for (const row of supply.items) {
          const value = action === "all" ? row.arrivedQuantity : integer(fact[supply.supplyId]?.[row.productId] ?? "");
          if (value === null || value < 0 || value > row.arrivedQuantity) throw Error(`Укажи принятое количество для «${row.productName}» от 0 до ${row.arrivedQuantity}.`);
          items.push({ productId: row.productId, factQuantity: value });
        }
      }
      const prompt = action === "reject" ? "Отказать в приёмке этой поставки?" : action === "all" ? "Принять все приехавшие продукты? Значения из полей будут проигнорированы." : "Принять указанные в полях количества?";
      if (!window.confirm(prompt)) return;
      setBusyId(supply.supplyId);
      if (action === "reject") await api.rejectSupply(restaurantId, supply.supplyId);
      else await api.acceptSupply(supply.supplyId, items);
      markSupplyProcessed(restaurantId, supply.supplyId);
      setProcessed((current) => [...current, supply.supplyId.toLowerCase()]);
      setSuccess(action === "reject" ? "Отказ отправлен и подтверждён сервером." : "Приёмка подтверждена сервером.");
    } catch (e) { setError(toApiError(e).message); }
    finally { setBusyId(""); }
  };

  const submitManual = async (action: "reject" | "accept" | "all") => {
    setError(""); setSuccess("");
    try {
      const supplyId = manualId.trim();
      if (!isGuid(supplyId)) throw Error("Введи настоящий UUID поставки.");
      const items: FactItem[] = [];
      if (action !== "reject") {
        if (!manual.length) throw Error("Добавь хотя бы одну позицию.");
        for (const row of manual) {
          if (!isGuid(row.productId.trim())) throw Error("Укажи UUID каждого продукта.");
          const arrived = integer(row.arrived);
          if (arrived === null) throw Error("Укажи, сколько единиц приехало, для каждой позиции.");
          const value = action === "all" ? arrived : integer(row.accepted);
          if (value === null || value < 0 || value > arrived) throw Error("Принятое количество не может превышать приехавшее.");
          items.push({ productId: row.productId.trim(), factQuantity: value });
        }
        if (new Set(items.map((i) => i.productId.toLowerCase())).size !== items.length) throw Error("Продукты в поставке не должны повторяться.");
      }
      if (!window.confirm(action === "reject" ? "Отказать в приёмке поставки?" : action === "all" ? "Принять всё указанное как приехавшее, игнорируя поля приёмки?" : "Принять количества из полей?")) return;
      setBusyId("manual");
      if (action === "reject") await api.rejectSupply(restaurantId, supplyId);
      else await api.acceptSupply(supplyId, items);
      markSupplyProcessed(restaurantId, supplyId);
      setProcessed((current) => [...current, supplyId.toLowerCase()]);
      setSuccess(action === "reject" ? "Отказ подтверждён сервером." : "Приёмка подтверждена сервером.");
      setManualId(""); setManual([newRow()]);
    } catch (e) { setError(toApiError(e).message); }
    finally { setBusyId(""); }
  };

  return <div className="space-y-6">
    <Heading eyebrow="Логистика · склад" title="Приёмка поставок" description="Проверь фактически приехавшие продукты и укажи, сколько принимаешь на склад."/>
    {!["owner", "admin"].includes(role) ? <Empty title="Приёмка недоступна">Для подтверждения поставок нужны права владельца или администратора.</Empty> : <>
      {(error || success) && <div className="space-y-2">{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{success && <Notice tone="success">{success}</Notice>}</div>}
      {supplies.length ? <div className="space-y-4">{supplies.map((supply) => <section key={supply.supplyId} className={`${surface} overflow-hidden`}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-5 py-5 md:px-6"><div className="flex items-start gap-3"><span className="rounded-xl bg-white p-2.5 text-indigo-600 shadow-sm"><Truck size={22}/></span><div><h3 className="font-extrabold text-slate-900">Поставка {supply.supplyNumber || supply.supplyId.slice(0, 8)}</h3><p title={supply.supplyId} className="mt-1 break-all font-mono text-xs text-slate-500">{supply.supplyId}</p>{supply.supplier && <p className="mt-1 text-xs text-slate-500">{supply.supplier}</p>}{supply.arrivedAt && !Number.isNaN(Date.parse(supply.arrivedAt)) && <p className="mt-1 text-xs text-slate-500">Создана: {new Date(supply.arrivedAt).toLocaleString("ru-RU")}</p>}</div></div><span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">{supply.items.length} поз.</span></header>
        <div className="space-y-4 p-5 md:p-6"><div className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid-cols-[minmax(0,1fr)_120px_160px]"><span>Продукт</span><span>Приехало</span><span>Принять</span></div>
          {supply.items.map((item) => <div key={item.productId} className="grid items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_120px_160px]"><div className="min-w-0"><p className="font-bold text-slate-800">{item.productName}</p><p title={item.productId} className="mt-1 truncate font-mono text-[11px] text-slate-400">{item.productId}</p>{item.expiresAt && !Number.isNaN(Date.parse(item.expiresAt)) && <p className="mt-1 text-xs text-slate-500">Срок до: {new Date(item.expiresAt).toLocaleString("ru-RU")}</p>}</div><div><p className="text-xs text-slate-500 md:hidden">Приехало</p><p className="text-lg font-extrabold text-indigo-700">{item.arrivedQuantity} <span className="text-xs font-medium text-slate-500">{item.unit}</span></p></div><label className="text-xs font-semibold text-slate-500 md:text-transparent">Принять<input type="number" min={0} max={item.arrivedQuantity} step={1} inputMode="numeric" aria-label={`Принять ${item.productName}`} value={fact[supply.supplyId]?.[item.productId] ?? ""} placeholder={String(item.arrivedQuantity)} onChange={(e) => setFact((old) => ({ ...old, [supply.supplyId]: { ...old[supply.supplyId], [item.productId]: e.target.value } }))} className={`${field} mt-1 text-slate-900`}/></label></div>)}
          <SupplyActions busy={!!busyId} onReject={() => void submit(supply, "reject")} onAccept={() => void submit(supply, "accept")} onAll={() => void submit(supply, "all")}/>
        </div>
      </section>)}</div> : <section className={`${surface} p-7`}><Empty title="Поставок для приёмки пока нет">Прибывшие поставки появятся, когда сервер передаст их состав и количества.</Empty></section>}
      <details className={`${surface} overflow-hidden`}><summary className="flex cursor-pointer items-center gap-3 px-5 py-5 text-sm font-bold text-slate-700 hover:bg-slate-50"><ClipboardCheck size={19} className="text-indigo-600"/> Приёмка по UUID вручную</summary><div className="space-y-5 border-t border-slate-100 p-5 md:p-6"><label className="block max-w-2xl text-sm font-semibold text-slate-700">UUID поставки<input spellCheck={false} className={`${field} mt-2 font-mono`} value={manualId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" onChange={(e) => setManualId(e.target.value)}/></label>
        <div className="space-y-3">{manual.map((row, i) => <div key={row.key} className="grid items-end gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_130px_130px_36px]"><label className="min-w-0 text-xs font-semibold text-slate-500">Продукт #{i + 1} · UUID<input spellCheck={false} className={`${field} mt-1 font-mono`} value={row.productId} onChange={(e) => setManual((old) => old.map((r) => r.key === row.key ? { ...r, productId: e.target.value } : r))}/></label><label className="text-xs font-semibold text-slate-500">Приехало<input type="number" step={1} min={0} className={`${field} mt-1`} value={row.arrived} onChange={(e) => setManual((old) => old.map((r) => r.key === row.key ? { ...r, arrived: e.target.value } : r))}/></label><label className="text-xs font-semibold text-slate-500">Принять<input type="number" step={1} min={0} className={`${field} mt-1`} value={row.accepted} onChange={(e) => setManual((old) => old.map((r) => r.key === row.key ? { ...r, accepted: e.target.value } : r))}/></label><button type="button" aria-label="Удалить позицию" disabled={manual.length === 1} onClick={() => setManual((old) => old.filter((r) => r.key !== row.key))} className="mb-1 rounded-xl p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30"><XCircle size={17}/></button></div>)}</div>
        <button type="button" onClick={() => setManual((old) => [...old, newRow()])} className="text-sm font-bold text-indigo-600">+ Добавить продукт</button>
        <SupplyActions busy={!!busyId} onReject={() => void submitManual("reject")} onAccept={() => void submitManual("accept")} onAll={() => void submitManual("all")}/>
      </div></details>
    </>}
  </div>;
}
