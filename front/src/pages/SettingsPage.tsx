import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Check, Copy, Eye, EyeOff, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Trash2, BookOpen, ChevronRight } from "lucide-react";
import { useRestaurantContext } from "../features/restaurant-runtime/context";
import { useDeleteRestaurant } from "../features/management/useManagement";
import { apiConfig } from "../shared/api/config";
import { nativeBackendApi } from "../shared/api/nativeBackendApi";
import { toApiError } from "../shared/api/errors";
import { ErrorNotice } from "../shared/ui/Feedback";

const surface = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6";
const roleNames: Record<string, string> = { owner: "Владелец", admin: "Администратор", manager: "Менеджер", cashier: "Кассир" };

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { restaurantId, name, role } = useRestaurantContext();
  const { remove, isLoading, error } = useDeleteRestaurant();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLiveOwner = apiConfig.mode === "live" && role === "owner";

  const refreshKey = async (signal?: AbortSignal) => {
    if (!isLiveOwner) return;
    setKeyLoading(true); setKeyError(""); setRevealed(false); setCopied(false); setKey(null);
    try {
      const result = await nativeBackendApi.supplierApiKey(restaurantId, signal);
      if (!signal?.aborted) setKey(result);
    } catch (reason) {
      if (!signal?.aborted) setKeyError(toApiError(reason).message);
    } finally { if (!signal?.aborted) setKeyLoading(false); }
  };
  useEffect(() => {
    if (!isLiveOwner) return;
    const controller = new AbortController();
    void refreshKey(controller.signal);
    return () => controller.abort();
  }, [restaurantId, isLiveOwner]);

  const copyKey = async () => {
    if (!key) return;
    try { await navigator.clipboard.writeText(key); setCopied(true); }
    catch { setKeyError("Не удалось скопировать ключ. Покажи его и скопируй вручную."); }
  };
  const handleDelete = async () => {
    if (confirmText !== name) return;
    try { await remove(); navigate("/"); } catch { /* ErrorNotice below. */ }
  };

  return <div className="mx-auto max-w-4xl space-y-6 pb-16">
    <div><div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-blue-600"><ShieldCheck size={16}/> Управление</div><h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Настройки ресторана</h2><p className="mt-2 text-sm text-slate-500">Данные организации, ключ поставщика и опасные действия</p></div>
    <ErrorNotice error={error}/>

    <section className={surface}>
      <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 size={19} className="text-blue-600"/> Информация о ресторане</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Название</p><p className="mt-1 font-bold text-slate-900">{name}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Роль</p><p className="mt-1 font-bold text-slate-900">{roleNames[role] || role}</p></div>
      </div>
      <div className="mt-4"><p className="text-xs font-medium text-slate-500">ID ресторана</p><p className="mt-1 break-all rounded-xl border border-slate-100 bg-slate-50 p-3 font-mono text-sm text-slate-700">{restaurantId}</p></div>
    </section>

    {apiConfig.mode === "live" && <section className={surface}>
      <div className="flex items-center justify-between gap-4"><div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><BookOpen size={20} className="text-blue-600"/> Редактор продуктов и меню</h3><p className="mt-2 text-sm text-slate-500">Создание продуктов, блюд и рецептов в одном красивом конструкторе. Опубликованные данные не подставляются вместо локального черновика.</p></div><Link to="../menu" aria-label="Открыть редактор меню и продуктов" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Открыть <ChevronRight size={16}/></Link></div>
    </section>}

    {isLiveOwner && <section className={surface}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><KeyRound size={20} className="text-violet-600"/> API-ключ поставщика</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">Ключ, который поставщик использует для обращения к вашему ресторану. Получаем напрямую из <code className="rounded bg-slate-100 px-1">GetUserRestaurants.apiKey</code>.</p></div><button type="button" disabled={keyLoading} onClick={() => void refreshKey()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16}/> Обновить</button></div>
      <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/50 p-4"><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-violet-700"><LockKeyhole size={15}/> Секретный ключ</p>
        <div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1 break-all rounded-lg border border-violet-100 bg-white px-4 py-3 font-mono text-sm text-slate-800" aria-label="API ключ поставщика">{keyLoading ? "Загрузка с сервера…" : keyError ? "Не удалось получить ключ" : !key ? "Ключ не возвращён сервером" : revealed ? key : "•".repeat(Math.min(key.length, 40))}</div>
          <button type="button" disabled={!key} onClick={() => setRevealed((v) => !v)} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-3 text-sm font-semibold text-violet-700 disabled:opacity-40"><span>{revealed ? <EyeOff size={17}/> : <Eye size={17}/>}</span>{revealed ? "Скрыть" : "Показать"}</button>
          <button type="button" disabled={!key} onClick={() => void copyKey()} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-40">{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? "Готово" : "Скопировать"}</button>
        </div>
      </div>
      {keyError && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{keyError}</p>}
    </section>}

    {role === "owner" && <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="flex items-center gap-2 text-lg font-extrabold text-rose-700"><Trash2 size={20}/> Опасная зона</h3>
      {!showConfirm ? <button type="button" onClick={() => setShowConfirm(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700"><Trash2 size={16}/> Удалить ресторан</button> : <div className="mt-5 space-y-3"><label className="block text-sm font-semibold text-slate-800">Напиши название «{name}» для подтверждения<input autoFocus aria-label="Название ресторана" className="mt-2 w-full rounded-xl border border-rose-200 px-4 py-3 outline-none focus:ring-2 focus:ring-rose-100" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={name}/></label><div className="flex flex-wrap gap-2"><button type="button" disabled={isLoading || confirmText !== name} onClick={() => void handleDelete()} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{isLoading ? "Удаление…" : "Удалить навсегда"}</button><button type="button" disabled={isLoading} onClick={() => { setShowConfirm(false); setConfirmText(""); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Отмена</button></div></div>}
    </section>}
  </div>;
};
