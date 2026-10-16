import { useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Monitor, PlusCircle } from "lucide-react";
import { useRestaurantContext } from "../../features/restaurant-runtime/context";
import { nativeBackendApi } from "../../shared/api/nativeBackendApi";
import { toApiError } from "../../shared/api/errors";
import { Notice, ErrorMessage, surface, primary, field } from "./NativeUI";

/** POS registration lives on the Employees page; no separate POS sales UI. */
export function CreateTerminalForm() {
  const { restaurantId } = useRestaurantContext();
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const create = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setMessage("");
    if (!/^\d{4,8}$/.test(pin)) { setError("PIN: от 4 до 8 цифр"); return; }
    setBusy(true);
    try {
      await nativeBackendApi.createPOS(restaurantId, pin);
      setPin(""); setMessage("Кассовый аппарат создан.");
    } catch (e) { setError(toApiError(e).message); }
    finally { setBusy(false); }
  };
  return <section className={`${surface} overflow-hidden`}>
    <div className="flex items-center gap-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-white p-6"><div className="rounded-2xl bg-white p-3 text-indigo-600 shadow-sm"><Monitor size={27}/></div><div><h3 className="text-lg font-extrabold">Кассовые аппараты</h3><p className="text-sm text-slate-500">Регистрация нового терминала</p></div></div>
    <form onSubmit={(e) => void create(e)} className="space-y-5 p-6">
      <label className="block max-w-md text-sm font-bold text-slate-800">PIN для устройства<div className="relative mt-2"><KeyRound className="absolute left-3.5 top-3.5 text-slate-400" size={18}/>
        <input type={showPin ? "text" : "password"} inputMode="numeric" autoComplete="new-password" maxLength={8} className={`${field} pl-11 pr-12`} placeholder="От 4 до 8 цифр" value={pin} onChange={(e) => setPin(e.target.value)} required/>
        <button type="button" aria-label={showPin ? "Скрыть PIN" : "Показать PIN"} className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:text-indigo-600" onClick={() => setShowPin((v) => !v)}>{showPin ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
      </div></label>
      <ErrorMessage value={error}/>{message && <Notice tone="success">{message}</Notice>}
      <button className={primary} disabled={busy}><PlusCircle size={18}/>{busy ? "Создание…" : "Создать аппарат"}</button>
    </form>
  </section>;
}
