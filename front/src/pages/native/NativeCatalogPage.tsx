import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRestaurantContext } from "../../features/restaurant-runtime/context";
import { nativeBackendApi as api, type NativeProductTemplate, type NativeDish } from "../../shared/api/nativeBackendApi";
import { useNativeLiveStore } from "../../shared/realtime/nativeLiveStore";
import { toApiError } from "../../shared/api/errors";

const card = "bg-white border border-gray-200 rounded-xl p-5 space-y-4";
const field = "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white font-mono text-sm";
type MenuDraft = Record<string, Record<string, number>>;

function parseCatalog(text: string): NativeProductTemplate[] {
  if (!text.trim()) throw Error("Загрузи полный JSON продуктов");
  const input: unknown = JSON.parse(text);
  if (!Array.isArray(input) || !input.length || input.length > 1000) throw Error("Продукты должны быть непустым массивом, максимум 1000 записей");
  const products: NativeProductTemplate[] = [];
  const names = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") throw Error("Неверный продукт в JSON");
    const p = raw as Record<string, unknown>;
    const name = typeof p.name === "string" ? p.name.trim() : "";
    const unit = typeof p.unit === "string" ? p.unit.trim() : "";
    const shelfLifeSeconds = p.shelfLifeSeconds;
    if (!name || !unit || !Number.isInteger(shelfLifeSeconds) || !(Number(shelfLifeSeconds) > 0))
      throw Error(`Продукт «${name || "без имени"}» должен иметь name, unit, shelfLifeSeconds > 0`);
    if (names.has(name.toLocaleLowerCase())) throw Error(`Дубликат продукта «${name}»`);
    names.add(name.toLocaleLowerCase());
    products.push({ name, unit, shelfLifeSeconds: Number(shelfLifeSeconds) });
  }
  return products;
}
function parseMenu(text: string, products: NativeProductTemplate[]): MenuDraft {
  if (!text.trim()) throw Error("Загрузи полный JSON меню");
  const input: unknown = JSON.parse(text);
  if (!input || typeof input !== "object" || Array.isArray(input) || !Object.keys(input).length) throw Error("Меню должно быть непустым объектом { блюдо: { ингредиент: количество } }");
  const productNames = new Set(products.map((p) => p.name));
  const menu: MenuDraft = {};
  for (const [dish, ingredients] of Object.entries(input)) {
    if (!dish.trim() || !ingredients || typeof ingredients !== "object" || Array.isArray(ingredients) || !Object.keys(ingredients).length)
      throw Error(`Неверный рецепт блюда «${dish}»`);
    menu[dish.trim()] = {};
    for (const [ingredient, qty] of Object.entries(ingredients)) {
      if (!productNames.has(ingredient)) throw Error(`В блюде «${dish}» продукт «${ingredient}» отсутствует в отправляемом JSON продуктов`);
      if (!Number.isInteger(qty) || Number(qty) <= 0) throw Error(`В блюде «${dish}» некорректное количество «${ingredient}»`);
      menu[dish.trim()][ingredient] = Number(qty);
    }
  }
  return menu;
}
function readFile(e: ChangeEvent<HTMLInputElement>, update: (s: string) => void) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 1_000_000) { window.alert("Максимальный размер JSON-файла: 1 МБ"); return; }
  void file.text().then(update).catch(() => window.alert("Не удалось прочитать JSON"));
  e.target.value = "";
}

export function NativeCatalogPage() {
  const { restaurantId, role } = useRestaurantContext();
  const [productsText, setProductsText] = useState("");
  const [menuText, setMenuText] = useState("");
  const [menuList, setMenuList] = useState<NativeDish[] | null>(null);
  const [menuError, setMenuError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState("");
  const batch = useNativeLiveStore((s) => s.restaurantId === restaurantId ? s.products : null);
  const received = useNativeLiveStore((s) => s.restaurantId === restaurantId ? s.receivedAt : "");
  useEffect(() => {
    const control = new AbortController();
    setMenuList(null); setMenuError(""); setProductsText(""); setMenuText(""); setConfirm("");
    void api.menu(restaurantId, control.signal).then(setMenuList).catch((e) => {
      if (!control.signal.aborted) setMenuError(toApiError(e).message);
    });
    return () => control.abort();
  }, [restaurantId]);
  const validation = useMemo(() => {
    if (!productsText.trim() || !menuText.trim()) return "Добавь оба полных JSON-файла";
    try {
      const p = parseCatalog(productsText);
      const m = parseMenu(menuText, p);
      return `${p.length} продуктов, ${Object.keys(m).length} блюд — оба JSON корректны`;
    } catch (e) { return e instanceof Error ? e.message : "Ошибка проверки JSON"; }
  }, [productsText, menuText]);
  const valid = validation.includes(" — оба JSON корректны");
  const save = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setMessage(""); setStep("");
    try {
      if (confirm !== "ЗАМЕНИТЬ") throw Error("Введи ЗАМЕНИТЬ, чтобы подтвердить замену всех продуктов и меню");
      const products = parseCatalog(productsText);
      const menu = parseMenu(menuText, products);
      if (!window.confirm("Внимание: оба серверных метода ПОЛНОСТЬЮ заменяют продукты и меню с новыми ID. Сначала отправить продукты, затем меню?")) return;
      setSending(true);
      setStep("1/2: отправляю полный каталог продуктов…");
      await api.replaceCatalog(restaurantId, products);
      setStep("2/2: продукты приняты, отправляю меню…");
      try {
        await api.replaceMenu(restaurantId, menu);
      } catch (e) {
        setError(`Продукты уже отправлены, но меню НЕ сохранено: ${toApiError(e).message}. НЕ повторяй отправку вслепую — проверь связи рецептов и состояние каталога на сервере.`);
        return;
      }
      setStep("Обе операции завершены");
      setMessage("Продукты и меню последовательно отправлены в существующие API. Новые данные меню читаются обратно с сервера.");
      setConfirm("");
      try { setMenuList(await api.menu(restaurantId, new AbortController().signal)); }
      catch (e) { setMenuError(toApiError(e).message); }
    } catch (e) { setError(e instanceof Error ? e.message : "Неизвестная ошибка"); }
    finally { setSending(false); }
  };
  return <div className="space-y-5">
    <h2 className="text-2xl font-bold">Меню и продукты</h2>
    <p className="text-sm text-gray-600">Одна страница и одна кнопка отправки. Оба запроса выполняются <strong>последовательно: сначала SetProducts, потом LoadRestaurantMenu</strong>, чтобы рецепты ссылались на только что загруженные продукты.</p>
    <div className="grid md:grid-cols-2 gap-4">
      <section className={card}><h3 className="font-semibold">Меню на сервере</h3><p className="text-xs text-gray-500">GET /api/POS/menu · только чтение</p>{menuError && <p role="alert" className="text-red-700">{menuError}</p>}
        {menuList === null ? <p>Загрузка…</p> : menuList.length ? menuList.map((d) => <div key={d.dishId} className="border-t pt-2">{d.name}</div>) : <p>Блюд нет</p>}</section>
      <section className={card}><h3 className="font-semibold">Остатки продуктов (SignalR)</h3>
        {batch === null ? <p className="text-gray-600 text-sm">Ожидание события ProductsUpdated. Сервер не отправляет начальный снимок склада при подписке.</p> : batch.length ? <div className="max-h-60 overflow-y-auto">{batch.map((b, i) => <div key={`${b.supplyId}-${b.productId}-${i}`} className="border-t py-2 text-sm">{b.productName} — {b.quantity} · до {new Date(b.expiresAt).toLocaleString("ru-RU")}</div>)}</div> : <p>Последнее событие: склад пуст</p>}
        {received && <p className="text-xs text-gray-500">Последнее событие: {new Date(received).toLocaleTimeString("ru-RU")}</p>}
        <p className="text-xs text-gray-500">Это остатки партий из FoodStock, не список всех шаблонов продуктов.</p></section>
    </div>
    {(["owner", "admin"].includes(role)) && <form className={card} onSubmit={(e) => void save(e)}>
      <h3 className="font-semibold">Загрузить новое меню и продукты одним действием</h3>
      <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded p-3"><strong>Осторожно:</strong> серверные методы удаляют старые сущности и создают новые ID. Нужны <b>полные</b> JSON, не отдельные добавления. Операции не являются одной SQL-транзакцией; если меню не сохранится, продукты уже могут измениться. При существующих заказах/рецептах запрос может быть отклонён по внешним ключам.</p>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="block text-sm space-y-2">1. Полный JSON продуктов <span className="text-gray-500">(array)</span>
          <input className="block text-xs" type="file" accept=".json,application/json" onChange={(e) => readFile(e, setProductsText)} />
          <textarea rows={11} className={field} value={productsText} placeholder={'[\n  {"name":"Мука","shelfLifeSeconds":864000,"unit":"кг"}\n]'} onChange={(e) => setProductsText(e.target.value)} aria-label="JSON продуктов" />
        </label>
        <label className="block text-sm space-y-2">2. Полный JSON меню <span className="text-gray-500">(object)</span>
          <input className="block text-xs" type="file" accept=".json,application/json" onChange={(e) => readFile(e, setMenuText)} />
          <textarea rows={11} className={field} value={menuText} placeholder={'{\n  "Пирог": { "Мука": 2 }\n}'} onChange={(e) => setMenuText(e.target.value)} aria-label="JSON меню" />
        </label>
      </div>
      <p role="status" className={`text-sm ${valid ? "text-green-700" : "text-amber-700"}`}>{validation}</p>
      <label className="block text-sm">Подтверждение: напиши <b>ЗАМЕНИТЬ</b><input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field + " mt-1"} autoComplete="off"/></label>
      {step && <p role="status" className="text-sm text-blue-700">{step}</p>}
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700 bg-green-50 p-3 rounded">{message}</p>}
      <button type="submit" disabled={sending || !valid || confirm !== "ЗАМЕНИТЬ"} className="px-5 py-3 rounded bg-blue-700 text-white disabled:opacity-50">{sending ? "Отправка…" : "Отправить продукты и меню"}</button>
    </form>}
  </div>;
}
