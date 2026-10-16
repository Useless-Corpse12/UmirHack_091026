import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useMenu } from "../features/restaurant-runtime/hooks";
import { menuDraftSchema } from "../shared/api/schemas";
import { ApiError } from "../shared/api/errors";
import { parseMenuFile, stringifyMenuFile } from "../shared/lib/menuFile";
import type { DishDraft, MenuDocument } from "../shared/types/models";
import { ErrorNotice } from "../shared/ui/Feedback";
import { unitLabel } from "../shared/lib/format";

type IngredientRow = { key: string; productId: string; quantity: string };
type DishRow = {
  key: string;
  dishId?: string;
  name: string;
  recipe: IngredientRow[];
};
const rows = (dishes: DishDraft[]): DishRow[] =>
  dishes.map((dish) => ({
    ...dish,
    key: crypto.randomUUID(),
    recipe: dish.recipe.map((item) => ({
      ...item,
      key: crypto.randomUUID(),
      quantity: String(item.quantity),
    })),
  }));
const draftOf = (dishes: DishRow[]): DishDraft[] =>
  dishes.map((dish) => ({
    ...(dish.dishId ? { dishId: dish.dishId } : {}),
    name: dish.name,
    recipe: dish.recipe.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
    })),
  }));
const messageOf = (error: unknown) =>
  error instanceof z.ZodError
    ? error.issues
        .map((issue) => `Блюдо ${Number(issue.path[0]) + 1}: ${issue.message}`)
        .join("; ")
    : error instanceof Error
      ? error.message
      : "Не удалось прочитать меню";

export const MenuPage = () => {
  const menu = useMenu();
  const [draft, setDraft] = useState<{
    dishes: DishRow[];
    version: number;
  } | null>(null);
  const [confirmed, setConfirmed] = useState<MenuDocument | null>(null);
  const source =
    confirmed && (!menu.data || confirmed.version > menu.data.version)
      ? confirmed
      : menu.data;
  const serverRows = useMemo(() => rows(source?.dishes || []), [source]);
  const dishes = draft?.dishes ?? serverRows;
  const version = draft?.version ?? source?.version ?? null;
  const dirty = draft !== null;
  const [fileBusy, setFileBusy] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const busy = menu.isSaving || fileBusy || reloading;
  const stale = source && version !== null && source.version > version;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const preview = useMemo(() => {
    try {
      return stringifyMenuFile(draftOf(dishes), menu.catalog);
    } catch {
      return "Заполните названия, ингредиенты и количество — здесь появится JSON всего меню.";
    }
  }, [dishes, menu.catalog]);
  const change = (next: DishRow[]) => {
    if (version === null) return;
    setDraft({ dishes: next, version });
    setError("");
    setMessage("");
    menu.clearSaveError();
  };
  const patchDish = (index: number, patch: Partial<DishRow>) =>
    change(dishes.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !menu.data) return;
    setFileBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > 1048576)
        throw new Error("Размер JSON не должен превышать 1 МБ");
      const imported = parseMenuFile(await file.text(), menu.catalog, [
        ...menu.data.dishes,
        ...draftOf(dishes),
      ]);
      change(rows(imported));
      setMessage(
        "Файл проверен. Он заменил черновик целиком; на сервере меню пока не изменилось.",
      );
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setFileBusy(false);
    }
  };
  const download = () => {
    setError("");
    try {
      const text = stringifyMenuFile(draftOf(dishes), menu.catalog);
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "menu.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Скачан JSON всего меню из редактора. Сохранение на сервер — отдельной кнопкой.",
      );
    } catch (err) {
      setError(messageOf(err));
    }
  };
  const save = async () => {
    if (version === null) return;
    setError("");
    setMessage("");
    try {
      const draft = menuDraftSchema.parse(draftOf(dishes));
      stringifyMenuFile(draft, menu.catalog);
      const result = await menu.save(draft, version);
      setConfirmed(result);
      setDraft(null);
      setMessage(`Меню сохранено целиком. Блюд: ${result.dishes.length}.`);
    } catch (err) {
      if (!(err instanceof ApiError)) setError(messageOf(err));
    }
  };
  const reload = async () => {
    setReloading(true);
    try {
      if (await menu.reload()) {
        setConfirmed(null);
        setDraft(null);
        setError("");
        menu.clearSaveError();
        setMessage("Черновик заменён актуальным меню с сервера.");
      }
    } finally {
      setReloading(false);
    }
  };
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold mb-2">Конструктор меню</h2>
        <p className="text-sm text-gray-600">
          Ингредиенты выбираются из каталога ресторана. Количество — на одну
          порцию. Для рецепта подходят и продукты с нулевым остатком:
          доступность блюда считает сервер.
        </p>
      </div>
      <ErrorNotice error={menu.error || menu.saveError} />
      {menu.loading && !menu.data && <p>Загрузка меню…</p>}
      {error && (
        <p
          role="alert"
          className="bg-red-50 border border-red-300 text-red-800 rounded p-3 text-sm"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm"
        >
          {message}
        </p>
      )}
      {stale && dirty && (
        <p
          role="alert"
          className="bg-amber-50 border border-amber-300 text-amber-900 rounded p-3 text-sm"
        >
          Меню изменили в другом окне. Ваш черновик не затёрт. Скачайте его,
          затем замените актуальным меню с сервера и повторите нужные изменения.
        </p>
      )}
      <fieldset
        disabled={busy || !menu.data}
        className="space-y-5 disabled:opacity-70"
      >
        <div className="bg-white border rounded p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-sm">
              Загрузить меню JSON
              <input
                aria-label="Загрузить меню JSON"
                type="file"
                accept=".json,application/json"
                onChange={(e) => void importFile(e)}
                className="block text-sm mt-1 max-w-full"
              />
            </label>
            <button
              type="button"
              onClick={download}
              className="border px-3 py-2 rounded text-sm"
            >
              Скачать всё меню JSON
            </button>
            <button
              type="button"
              onClick={() => void reload()}
              className="border px-3 py-2 rounded text-sm"
            >
              Заменить черновик меню с сервера
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Формат файла: {`{"Овощной салат":{"Томаты":2,"Огурцы":1}}`}. Импорт
            заменяет весь черновик. Изменения отправляются на сервер только при
            сохранении.
          </p>
          <p className="text-sm" data-testid="menu-draft-status">
            {dirty
              ? "Есть несохранённые изменения"
              : "Меню совпадает с сервером"}
            {version !== null && ` · Версия ${version}`}
          </p>
        </div>
        {!menu.catalog.length && menu.data && (
          <p className="bg-amber-50 border rounded p-3 text-sm">
            Сначала добавьте продукты на вкладке «Продукты». После этого можно
            собрать рецепты.
          </p>
        )}
        {!dishes.length && menu.data && (
          <p className="text-gray-500">
            Меню пустое. Добавьте первое блюдо или загрузите JSON.
          </p>
        )}
        <div className="space-y-4">
          {dishes.map((dish, index) => (
            <div
              key={dish.key}
              className="bg-white border rounded p-4 space-y-4"
              data-testid="menu-dish"
            >
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <label className="min-w-0 text-sm font-medium">
                  Название блюда {index + 1}
                  <input
                    aria-label={`Название блюда ${index + 1}`}
                    value={dish.name}
                    maxLength={100}
                    onChange={(e) => patchDish(index, { name: e.target.value })}
                    className="block border rounded p-2 w-full mt-1"
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Удалить блюдо ${index + 1}`}
                  onClick={() => change(dishes.filter((_, i) => i !== index))}
                  className="text-red-700 border border-red-200 rounded px-3 py-2 text-sm"
                >
                  Удалить блюдо
                </button>
              </div>
              <div className="space-y-3">
                {dish.recipe.map((item, ingredientIndex) => {
                  const product = menu.catalog.find(
                    (p) => p.productId === item.productId,
                  );
                  const update = (patch: Partial<IngredientRow>) =>
                    patchDish(index, {
                      recipe: dish.recipe.map((r, i) =>
                        i === ingredientIndex ? { ...r, ...patch } : r,
                      ),
                    });
                  return (
                    <div
                      key={item.key}
                      className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_8rem_auto] gap-3 items-end border-t pt-3"
                    >
                      <label className="col-span-2 sm:col-span-1 min-w-0 text-sm">
                        Ингредиент {ingredientIndex + 1}
                        <select
                          aria-label={`Ингредиент ${ingredientIndex + 1} блюда ${index + 1}`}
                          value={item.productId}
                          onChange={(e) =>
                            update({ productId: e.target.value })
                          }
                          className="block border rounded p-2 w-full mt-1 min-w-0"
                        >
                          <option value="">Выберите продукт</option>
                          {item.productId && !product && (
                            <option value={item.productId}>
                              Продукт больше не доступен — выберите другой
                            </option>
                          )}
                          {menu.catalog.map((p) => (
                            <option
                              key={p.productId}
                              value={p.productId}
                              disabled={dish.recipe.some(
                                (r) =>
                                  r.key !== item.key &&
                                  r.productId === p.productId,
                              )}
                            >
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm w-full min-w-0">
                        Количество
                        {product?.unit ? ` (${unitLabel(product.unit)})` : ""}
                        <input
                          aria-label={`Количество ингредиента ${ingredientIndex + 1} блюда ${index + 1}`}
                          type="number"
                          inputMode="decimal"
                          min="0.001"
                          max="1000000000"
                          step="0.001"
                          value={item.quantity}
                          onChange={(e) => update({ quantity: e.target.value })}
                          className="block border rounded p-2 w-full mt-1"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Удалить ингредиент ${ingredientIndex + 1} блюда ${index + 1}`}
                        onClick={() =>
                          patchDish(index, {
                            recipe: dish.recipe.filter(
                              (_, i) => i !== ingredientIndex,
                            ),
                          })
                        }
                        className="text-red-700 border border-red-200 rounded px-3 py-2 text-sm"
                      >
                        Убрать
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={
                  dish.recipe.length >= 100 ||
                  dish.recipe.length >= menu.catalog.length
                }
                onClick={() =>
                  patchDish(index, {
                    recipe: [
                      ...dish.recipe,
                      {
                        key: crypto.randomUUID(),
                        productId:
                          menu.catalog.find(
                            (p) =>
                              !dish.recipe.some(
                                (r) => r.productId === p.productId,
                              ),
                          )?.productId || "",
                        quantity: "1",
                      },
                    ],
                  })
                }
                className="text-blue-600 border rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                Добавить ингредиент в блюдо {index + 1}
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!menu.catalog.length || dishes.length >= 1000}
            onClick={() =>
              change([
                ...dishes,
                {
                  key: crypto.randomUUID(),
                  name: "",
                  recipe: [
                    {
                      key: crypto.randomUUID(),
                      productId: menu.catalog[0]?.productId || "",
                      quantity: "1",
                    },
                  ],
                },
              ])
            }
            className="border rounded px-4 py-2 disabled:opacity-50"
          >
            Добавить блюдо
          </button>
          <button
            type="button"
            disabled={!dirty || !!stale}
            onClick={() => void save()}
            className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {menu.isSaving ? "Сохранение…" : "Сохранить всё меню"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Сохранение заменяет меню целиком, включая удаление убранных блюд.
          Пустое меню снимает все блюда с продажи. Прошлые заказы и складские
          остатки сохраняются.
        </p>
      </fieldset>
      <details className="bg-white border rounded p-4">
        <summary className="cursor-pointer text-sm font-medium">
          JSON всего меню из редактора
        </summary>
        <pre
          data-testid="menu-json-preview"
          className="mt-3 text-xs whitespace-pre-wrap break-words max-h-96 overflow-auto"
        >
          {preview}
        </pre>
      </details>
    </section>
  );
};
