import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertTriangle, ArrowLeft, ChefHat,
  Download, FileJson, FileUp, Leaf, Plus,
  Search, Sparkles, Trash2, UploadCloud, X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useRestaurantContext } from "../../features/restaurant-runtime/context";
import { nativeBackendApi as api, type NativeProductTemplate } from "../../shared/api/nativeBackendApi";
import { toApiError } from "../../shared/api/errors";
import { ShelfLifeEditor } from "./ShelfLifeEditor";

type MenuDraft = Record<string, Record<string, number>>;
type LocalProduct = NativeProductTemplate & { clientId: number };
type LocalDish = { clientId: number; name: string; ingredients: { clientId: number; name: string; quantity: number }[] };
const input = "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const panel = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const button = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
let nextId = 1;
function newId() { return nextId++; }
function product(name = "", unit = "шт", seconds = 86400): LocalProduct { return { clientId: newId(), name, unit, shelfLifeSeconds: seconds }; }
function newDish(name = ""): LocalDish { return { clientId: newId(), name, ingredients: [{ clientId: newId(), name: "", quantity: 1 }] }; }
function parseProducts(json: unknown): NativeProductTemplate[] {
  if (!Array.isArray(json) || json.length < 1 || json.length > 1000) throw Error("Нужен массив из 1–1000 продуктов");
  const used = new Set<string>();
  return json.map((entry, i) => {
    if (!entry || typeof entry !== "object") throw Error(`Неверная запись продукта №${i + 1}`);
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === "string" ? e.name.trim() : "";
    const unit = typeof e.unit === "string" ? e.unit.trim() : "";
    if (!name || !unit || !(typeof e.shelfLifeSeconds === "number" && Number.isInteger(e.shelfLifeSeconds)) || Number(e.shelfLifeSeconds) <= 0) throw Error(`Продукт №${i + 1}: укажи name, unit и положительное целое shelfLifeSeconds`);
    if (used.has(name.toLocaleLowerCase("ru"))) throw Error(`Название «${name}» повторяется`);
    used.add(name.toLocaleLowerCase("ru"));
    return { name, unit, shelfLifeSeconds: Number(e.shelfLifeSeconds) };
  });
}
function parseMenu(json: unknown): MenuDraft {
  if (!json || typeof json !== "object" || Array.isArray(json) || !Object.keys(json).length) throw Error("Меню должно быть объектом с рецептами блюд");
  const result: MenuDraft = {};
  for (const [name, value] of Object.entries(json)) {
    if (!name.trim() || !value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length < 1) throw Error(`Блюдо «${name}» должно содержать ингредиенты`);
    const ingredients: Record<string, number> = {};
    for (const [ingredient, qty] of Object.entries(value)) {
      if (!ingredient.trim() || !(typeof qty === "number" && Number.isInteger(qty)) || Number(qty) <= 0) throw Error(`Некорректное количество ингредиента «${ingredient}» в «${name}»`);
      ingredients[ingredient] = Number(qty);
    }
    result[name.trim()] = ingredients;
  }
  return result;
}
function dishRows(menu: MenuDraft): LocalDish[] {
  return Object.entries(menu).map(([name, ingredients]) => ({
    clientId: newId(), name,
    ingredients: Object.entries(ingredients).map(([p, qty]) => ({ clientId: newId(), name: p, quantity: qty })),
  }));
}
function getMenu(rows: LocalDish[], products: NativeProductTemplate[]): MenuDraft {
  if (!rows.length) throw Error("Добавь хотя бы одно блюдо — меню должно быть полным");
  const names = new Set(products.map((p) => p.name));
  const dishNames = new Set<string>();
  const result: MenuDraft = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name || dishNames.has(name.toLocaleLowerCase("ru"))) throw Error(`У блюд должны быть уникальные названия${name ? `: «${name}»` : ""}`);
    dishNames.add(name.toLocaleLowerCase("ru"));
    if (!row.ingredients.length) throw Error(`Добавь ингредиент в блюдо «${name}»`);
    const ingredients: Record<string, number> = {};
    for (const item of row.ingredients) {
      if (!names.has(item.name)) throw Error(`В блюде «${name}» ингредиент «${item.name || "не выбран"}» отсутствует в списке продуктов`);
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw Error(`В «${name}» количество должно быть положительным целым`);
      if (ingredients[item.name]) throw Error(`В «${name}» повторяется ингредиент «${item.name}»`);
      ingredients[item.name] = item.quantity;
    }
    result[name] = ingredients;
  }
  return result;
}
function downloadFile(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function NativeCatalogPage() {
  const { restaurantId, role } = useRestaurantContext();
  const canEdit = ["owner", "admin"].includes(role);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [dishes, setDishes] = useState<LocalDish[]>([]);
  const [search, setSearch] = useState("");
  const [openImport, setOpenImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importKind, setImportKind] = useState<"products" | "menu">("products");
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const draftKey = `umir-visual-catalog-draft:${restaurantId}`;

  useEffect(() => {
    let active = true;
    setMessage(""); setError(""); setProducts([]); setDishes([]); setDraftLoaded(false);
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const json = JSON.parse(raw) as { products?: unknown; dishes?: unknown; menu?: unknown };
        if (Array.isArray(json.products)) {
          if (json.products.length <= 1000) {
            const rows = json.products.filter((p): p is Record<string, unknown> => !!p && typeof p === "object");
            if (active) setProducts(rows.map((p) => product(
              typeof p.name === "string" ? p.name : "",
              typeof p.unit === "string" ? p.unit : "шт",
              typeof p.shelfLifeSeconds === "number" ? p.shelfLifeSeconds : 86400,
            )));
          }
        }
        if (Array.isArray(json.dishes) && json.dishes.length <= 1000) {
          const restored = json.dishes.filter((d): d is Record<string, unknown> => !!d && typeof d === "object");
          if (active) setDishes(restored.map((d) => ({
            clientId: newId(), name: typeof d.name === "string" ? d.name : "",
            ingredients: Array.isArray(d.ingredients) && d.ingredients.length <= 1000
              ? d.ingredients.filter((i): i is Record<string, unknown> => !!i && typeof i === "object").map((i) => ({
                clientId: newId(), name: typeof i.name === "string" ? i.name : "",
                quantity: typeof i.quantity === "number" ? i.quantity : 1,
              }))
              : [],
          })));
        } else if (json.menu && typeof json.menu === "object" && Object.keys(json.menu).length) {
          if (active) setDishes(dishRows(parseMenu(json.menu)));
        }
      }
    } catch { /* Malformed local draft must not be sent to server. */ }
    if (active) setDraftLoaded(true);
    return () => { active = false; };
  }, [restaurantId, draftKey]);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      // Keep unfinished edits local; NEVER imply a draft is a server catalog.
      localStorage.setItem(draftKey, JSON.stringify({
        products: products.map(({ name, unit, shelfLifeSeconds }) => ({ name, unit, shelfLifeSeconds })),
        dishes: dishes.map((d) => ({ name: d.name, ingredients: d.ingredients.map((i) => ({ name: i.name, quantity: i.quantity })) })),
      }));
    } catch { /* Storage disabled/quota exceeded: editing still works. */ }
  }, [products, dishes, draftKey, draftLoaded]);

  const validated = useMemo(() => {
    try {
      const ps = parseProducts(products.map(({ name, unit, shelfLifeSeconds }) => ({ name, unit, shelfLifeSeconds })));
      const menu = getMenu(dishes, ps);
      return { error: "", products: ps, menu };
    } catch (e) { return { error: e instanceof Error ? e.message : "Некорректные данные", products: null, menu: null }; }
  }, [products, dishes]);

  const updateProduct = (id: number, field: "name" | "unit" | "shelfLifeSeconds", value: string | number) => {
    setProducts((prev) => prev.map((p) => p.clientId === id ? { ...p, [field]: value } : p));
    setShowPublishConfirm(false);
  };
  const editProductName = (id: number, name: string) => {
    const old = products.find((p) => p.clientId === id)?.name;
    updateProduct(id, "name", name);
    if (old && old !== name) setDishes((prev) => prev.map((d) => ({ ...d, ingredients: d.ingredients.map((i) => i.name === old ? { ...i, name } : i) })));
  };
  const deleteProduct = (id: number) => {
    const item = products.find((p) => p.clientId === id);
    if (item && dishes.some((d) => d.ingredients.some((i) => i.name === item.name))) {
      setError(`«${item.name}» используется в рецепте. Сначала удали ингредиент из блюда.`); return;
    }
    setProducts((prev) => prev.filter((p) => p.clientId !== id)); setShowPublishConfirm(false);
  };
  const patchDish = (id: number, change: Partial<LocalDish>) => { setDishes((prev) => prev.map((d) => d.clientId === id ? { ...d, ...change } : d)); setShowPublishConfirm(false); };
  const patchIngredient = (dishId: number, ingredientId: number, change: { name?: string; quantity?: number }) => {
    setDishes((prev) => prev.map((d) => d.clientId === dishId ? { ...d, ingredients: d.ingredients.map((i) => i.clientId === ingredientId ? { ...i, ...change } : i) } : d)); setShowPublishConfirm(false);
  };
  const importJson = (raw: string, kind: "products" | "menu") => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (kind === "products") {
        const ps = parseProducts(parsed);
        setProducts(ps.map((p) => product(p.name, p.unit, p.shelfLifeSeconds)));
        setMessage(`Импортированы ${ps.length} продуктов в черновик. На сервер пока ничего не отправлено.`);
      } else {
        const ms = parseMenu(parsed);
        setDishes(dishRows(ms));
        setMessage(`Импортированы ${Object.keys(ms).length} блюд в черновик. На сервер пока ничего не отправлено.`);
      }
      setShowPublishConfirm(false); setOpenImport(false); setImportText(""); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось прочитать JSON"); }
  };
  const importFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) { setError("Максимальный размер JSON — 1 МБ"); return; }
    void file.text().then((content) => importJson(content, importKind)).catch(() => setError("Ошибка чтения файла"));
  };
  const save = async () => {
    setError(""); setMessage(""); setStep("");
    if (!validated.products || !validated.menu) {
      setError(validated.error || "Исправь данные перед отправкой"); return;
    }
    setSending(true);
    try {
      setStep("1 из 2 · отправляем продукты…");
      await api.replaceCatalog(restaurantId, validated.products);
      setStep("2 из 2 · отправляем меню…");
      try {
        await api.replaceMenu(restaurantId, validated.menu);
      } catch (reason) {
        setError(`Частичное сохранение: продукты обновлены, но меню не сохранилось — ${toApiError(reason).message}. Не повторяй операцию без проверки данных в базе.`);
        return;
      }
      setStep("Готово: сервер подтвердил оба запроса");
      setMessage("Продукты и меню успешно отправлены. Локальная копия осталась в редакторе для следующего изменения.");
      setShowPublishConfirm(false);
    } catch (reason) {
      setError(toApiError(reason).message);
    } finally { setSending(false); }
  };
  const beginPublish = () => {
    setError(""); setMessage("");
    if (!canEdit) return;
    if (!validated.products || !validated.menu) {
      setError(validated.error || "Заполни продукты и блюда"); return;
    }
    setShowPublishConfirm(true);
  };
  const found = products.filter((p) => p.name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")));

  return <div className="mx-auto max-w-6xl space-y-6 pb-16">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link to="../settings" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600"><ArrowLeft size={14}/> К настройкам</Link>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600"><Sparkles size={15}/> Редактор · локальный черновик</div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Редактор меню и продуктов</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Заполни товары и рецепты. Затем нажми «Отправить всё» и подтверди действие. Оба каталога уйдут на сервер по очереди.</p>
      </div>
      {canEdit && <button type="button" className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} onClick={() => setOpenImport(true)}><FileUp size={16}/> Импорт JSON</button>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={`${panel} flex items-center gap-4 p-4`}><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Leaf size={21}/></div><div><p className="text-xs font-medium text-slate-500">Продуктов в редакторе</p><p className="text-2xl font-bold text-slate-900">{products.length}</p></div></div>
      <div className={`${panel} flex items-center gap-4 p-4`}><div className="rounded-xl bg-violet-50 p-3 text-violet-600"><ChefHat size={21}/></div><div><p className="text-xs font-medium text-slate-500">Блюд в редакторе</p><p className="text-2xl font-bold text-slate-900">{dishes.length}</p></div></div>
    </div>
    {(error || message) && <div role={error ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span className="flex-1">{error || message}</span><button type="button" aria-label="Закрыть сообщение" onClick={() => { setError(""); setMessage(""); }}><X size={16}/></button></div>}

    <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
      <section className={`${panel} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 md:px-6">
          <div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Leaf size={19} className="text-blue-600"/> Каталог продуктов</h3><p className="mt-1 text-xs text-slate-500">Наименования, единицы измерения и сроки годности</p></div>
          {canEdit && <button type="button" onClick={() => { setProducts((p) => [...p, product()]); setShowPublishConfirm(false); }} className={`${button} bg-blue-600 text-white hover:bg-blue-700`}><Plus size={16}/> Продукт</button>}
        </div>
        <div className="p-5 md:p-6">
          <div className="relative mb-4"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><input className={`${input} pl-10`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по продуктам…" aria-label="Поиск продуктов" /></div>
          {products.length === 0 ? <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center"><div className="mb-3 rounded-2xl bg-white p-4 text-blue-500 shadow-sm"><Leaf size={28}/></div><p className="font-semibold text-slate-800">Пока ни одного продукта</p><p className="mt-1 max-w-xs text-sm text-slate-500">Создай первый продукт или импортируй полный JSON. Демоданные мы не подставляем.</p>{canEdit && <button type="button" className="mt-4 font-semibold text-blue-600" onClick={() => setProducts([product()])}>+ Создать продукт</button>}</div>
            : found.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">По запросу ничего не найдено</p>
            : <div className="space-y-2.5">{found.map((p, i) => <div key={p.clientId} className="rounded-xl border border-slate-200 p-3.5 transition hover:border-blue-200 hover:bg-blue-50/20">
              <div className="mb-3 flex items-center justify-between"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">#{i + 1}</span>{canEdit && <button type="button" title="Удалить продукт из черновика" aria-label={`Удалить продукт ${p.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" onClick={() => deleteProduct(p.clientId)}><Trash2 size={16}/></button>}</div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_92px_minmax(0,1.2fr)]"><label className="min-w-0 text-xs font-medium text-slate-500">Название<input disabled={!canEdit} className={`${input} mt-1`} value={p.name} onChange={(e) => editProductName(p.clientId, e.target.value)} placeholder="Например, мука" /></label><label className="text-xs font-medium text-slate-500">Ед.<input disabled={!canEdit} className={`${input} mt-1`} value={p.unit} onChange={(e) => updateProduct(p.clientId, "unit", e.target.value)} placeholder="кг" /></label><div className="min-w-0"><p className="mb-1 text-xs font-medium text-slate-500">Срок годности</p><ShelfLifeEditor value={p.shelfLifeSeconds} disabled={!canEdit} onChange={(value) => updateProduct(p.clientId, "shelfLifeSeconds", value)}/></div></div>
            </div>)}</div>}
          {canEdit && products.length > 0 && <button type="button" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600" onClick={() => setProducts((p) => [...p, product()])}><Plus size={16}/> Добавить ещё продукт</button>}
        </div>
      </section>

      <section className={`${panel} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 md:px-6"><div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ChefHat size={19} className="text-violet-600"/> Конструктор меню</h3><p className="mt-1 text-xs text-slate-500">Собери блюда из продуктов каталога</p></div>{canEdit && <button type="button" onClick={() => { setDishes((old) => [...old, newDish()]); setShowPublishConfirm(false); }} className={`${button} bg-violet-600 text-white hover:bg-violet-700`}><Plus size={16}/> Блюдо</button>}</div>
        <div className="p-5 md:p-6">
          {!dishes.length ? <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center"><div className="mb-3 rounded-2xl bg-white p-4 text-violet-500 shadow-sm"><ChefHat size={28}/></div><p className="font-semibold text-slate-800">Меню пока пустое</p><p className="mt-1 text-sm text-slate-500">Добавь блюда, затем выбери продукты и укажи количество ингредиентов.</p>{canEdit && <button type="button" className="mt-4 font-semibold text-violet-600" onClick={() => setDishes([newDish()])}>+ Создать блюдо</button>}</div>
            : <div className="space-y-3">{dishes.map((dish, index) => <div key={dish.clientId} className="overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 font-bold text-violet-700">{index + 1}</div><input aria-label="Название блюда" disabled={!canEdit} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400" placeholder="Название блюда" value={dish.name} onChange={(e) => patchDish(dish.clientId, { name: e.target.value })}/>{canEdit && <button type="button" title="Удалить блюдо из черновика" className="p-1 text-slate-400 hover:text-rose-600" onClick={() => setDishes((prev) => prev.filter((d) => d.clientId !== dish.clientId))}><Trash2 size={16}/></button>}</div>
              <div className="space-y-2.5 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ингредиенты · {dish.ingredients.length}</p>{dish.ingredients.map((ing) => <div key={ing.clientId} className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-medium text-slate-500">Продукт<select aria-label="Ингредиент" disabled={!canEdit} className={`${input} mt-1`} value={ing.name} onChange={(e) => patchIngredient(dish.clientId, ing.clientId, { name: e.target.value })}><option value="">Выбрать…</option>{products.map((p) => <option key={p.clientId} value={p.name}>{p.name || "Без имени"}</option>)}</select></label><label className="w-20 shrink-0 text-xs font-medium text-slate-500">Кол-во<input aria-label="Количество ингредиента" disabled={!canEdit} className={`${input} mt-1`} type="number" min={1} step={1} value={Number.isFinite(ing.quantity) ? ing.quantity : ""} onChange={(e) => patchIngredient(dish.clientId, ing.clientId, { quantity: Number(e.target.value) })}/></label>{canEdit && <button type="button" title="Убрать ингредиент" className="mb-1 rounded-lg p-2 text-slate-400 hover:text-rose-600" onClick={() => patchDish(dish.clientId, { ingredients: dish.ingredients.filter((x) => x.clientId !== ing.clientId) })}><X size={16}/></button>}</div>)}{canEdit && <button type="button" className="inline-flex items-center gap-2 pt-1 text-xs font-bold text-violet-600" onClick={() => patchDish(dish.clientId, { ingredients: [...dish.ingredients, { clientId: newId(), name: "", quantity: 1 }] })}><Plus size={15}/> Ингредиент</button>}</div></div>)}</div>}
          {canEdit && dishes.length > 0 && <button type="button" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-600" onClick={() => setDishes((prev) => [...prev, newDish()])}><Plus size={16}/> Добавить блюдо</button>}
        </div>
      </section>
    </div>

    {canEdit && <section className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 px-5 py-5 md:px-6"><div className="rounded-xl bg-white p-2.5 text-blue-600 shadow-sm"><UploadCloud size={22}/></div><div className="flex-1"><h3 className="text-lg font-extrabold text-slate-900">Готово к отправке?</h3><p className="text-sm text-slate-600">Одна кнопка · продукты и меню вместе, последовательно</p></div></div>
      <div className="space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={sending || !!validated.error} onClick={beginPublish} className={`${button} min-h-11 bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700`}><UploadCloud size={17}/>{sending ? "Отправка…" : "Отправить всё"}</button><span className="text-xs text-slate-500">После нажатия откроется одно подтверждение.</span></div>
        {step && <p role="status" className="text-sm font-semibold text-blue-700">{step}</p>}
        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4"><button type="button" className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} onClick={() => downloadFile(products.map(({ name, unit, shelfLifeSeconds }) => ({ name, unit, shelfLifeSeconds })), "products.json")}><Download size={16}/> Скачать черновик продуктов</button><button type="button" className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} onClick={() => downloadFile(Object.fromEntries(dishes.map((d) => [d.name, Object.fromEntries(d.ingredients.map((i) => [i.name, i.quantity]))])), "menu.json")}><Download size={16}/> Скачать черновик меню</button></div>
      </div>
    </section>}

    {showPublishConfirm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) setShowPublishConfirm(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="publish-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl md:p-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><AlertTriangle size={24}/></div>
        <h3 id="publish-title" className="text-xl font-extrabold text-slate-900">Заменить продукты и меню?</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Ты отправляешь <strong>{products.length} продуктов и {dishes.length} блюд</strong>. Сервер может удалить предыдущий каталог и создать его заново. Это затронет рецепты и связанные данные. Проверь, что черновик полный.</p>
        <div className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p><strong>1.</strong> SetProducts — заменить весь каталог продуктов</p><p><strong>2.</strong> LoadRestaurantMenu — заменить всё меню после успеха первого запроса</p><p className="text-xs font-semibold">Если второй шаг не удастся, первый не откатится автоматически.</p></div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        {step && <p role="status" className="mt-3 text-sm font-semibold text-blue-700">{step}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" disabled={sending} onClick={() => setShowPublishConfirm(false)} className={`${button} border border-slate-200 text-slate-700`}>Отмена</button><button type="button" disabled={sending || !!validated.error} onClick={() => void save()} className={`${button} bg-blue-600 text-white hover:bg-blue-700`}><UploadCloud size={16}/>{sending ? "Отправка…" : "Окей, отправить"}</button></div>
      </section>
    </div>}

    {openImport && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpenImport(false); }}><section role="dialog" aria-modal="true" aria-label="Импорт JSON" className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FileJson className="text-blue-600" size={20}/> Импорт JSON в черновик</h3><button type="button" aria-label="Закрыть" onClick={() => setOpenImport(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div><p className="mt-2 text-sm text-slate-500">Импорт заменит соответствующую часть локального черновика, но <strong>не отправит данные на сервер</strong>.</p><div className="mt-5 flex gap-2">{(["products", "menu"] as const).map((kind) => <button key={kind} type="button" className={`${button} flex-1 ${importKind === kind ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`} onClick={() => { setImportKind(kind); setImportText(""); }}>{kind === "products" ? "Продукты" : "Меню"}</button>)}</div><div className="mt-4 flex flex-wrap items-center gap-3"><input ref={fileInput} className="hidden" type="file" accept=".json,application/json" onChange={importFile}/><button type="button" className={`${button} border border-slate-200 text-slate-700`} onClick={() => fileInput.current?.click()}><FileUp size={16}/> Выбрать JSON-файл</button><span className="text-xs text-slate-400">или вставь содержимое ниже</span></div><textarea className={`${input} mt-3 font-mono`} rows={8} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={importKind === "products" ? '[{"name":"Мука","unit":"кг","shelfLifeSeconds":864000}]' : '{"Пирог":{"Мука":2}}'}/><button type="button" disabled={!importText.trim()} className={`${button} mt-4 w-full bg-blue-600 text-white`} onClick={() => importJson(importText, importKind)}>Импортировать в редактор</button></section></div>}
  </div>;
}
