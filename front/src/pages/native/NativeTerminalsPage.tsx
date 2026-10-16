import { useState } from "react";
import type { FormEvent } from "react";
import { useRestaurantContext } from "../../features/restaurant-runtime/context";
import { nativeBackendApi } from "../../shared/api/nativeBackendApi";
import { toApiError } from "../../shared/api/errors";
export function NativeTerminalsPage() {
  const { restaurantId } = useRestaurantContext();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const create = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setMessage("");
    if (!/^\d{4,8}$/.test(pin)) { setError("PIN: от 4 до 8 цифр"); return; }
    setBusy(true);
    try {
      await nativeBackendApi.createPOS(restaurantId, pin);
      setPin(""); setMessage("Метод CreatePOS успешно выполнен. Новый кассовый аппарат создан сервером.");
    } catch (e) { setError(toApiError(e).message); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5"><h2 className="text-2xl font-bold">Кассовые аппараты</h2>
    <p className="text-gray-600 text-sm">Здесь только создание учётной записи кассового аппарата. Самого интерфейса продажи/корзины нет.</p>
    <form onSubmit={(e) => void create(e)} className="max-w-xl bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold">Создать кассу</h3>
      <p className="text-gray-500 text-xs break-all">Ресторан: {restaurantId}</p>
      <label className="block text-sm space-y-2">PIN для кассы
        <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} className="w-full border rounded-lg px-3 py-2" placeholder="4–8 цифр" value={pin} onChange={(e) => setPin(e.target.value)} required/>
      </label>
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">Текущий CreatePOS создаёт технического пользователя с одинаковым email для всех касс одного ресторана. Повторное создание может быть отклонено уникальным индексом Users.Email. Кроме того, в API нет метода списка касс — существующие здесь не отображаются.</p>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      {message && <p role="status" className="text-green-700 text-sm">{message}</p>}
      <button className="px-4 py-2 rounded bg-blue-700 text-white disabled:opacity-50" disabled={busy}>{busy ? "Создание…" : "Создать кассу"}</button>
    </form>
  </div>;
}
