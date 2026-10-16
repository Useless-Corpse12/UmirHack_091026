import { useState } from "react";
import { z } from "zod";
import { useCatalog } from "../features/restaurant-runtime/hooks";
import { inventoryApi } from "../shared/api/inventoryApi";
import { stringifyProductsFile } from "../shared/lib/productsFile";
import { useRestaurantContext } from "../features/restaurant-runtime/context";
import { productsDraftSchema } from "../shared/api/schemas";
import type { Product, ProductDraft } from "../shared/types/models";
import { ErrorNotice } from "../shared/ui/Feedback";
import { FormDialog } from "../shared/ui/FormDialog";
import {
  durationLabel,
  durationSeconds,
  splitDuration,
  type DurationParts,
} from "../shared/lib/shelfLife";
import { unitLabel } from "../shared/lib/format";

const durationFields = [
  { key: "days", label: "Дни", max: 3650 },
  { key: "hours", label: "Часы", max: 23 },
  { key: "minutes", label: "Минуты", max: 59 },
  { key: "seconds", label: "Секунды", max: 59 },
] as const;
const errorText = (error: unknown) =>
  error instanceof z.ZodError
    ? error.issues.map((i) => i.message).join("; ")
    : error instanceof Error
      ? error.message
      : "Ошибка файла";
export const ProductsPage = () => {
  const { role, restaurantId } = useRestaurantContext();
  const { data, loading, error, reload, save, isSaving, saveError } =
    useCatalog();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<DurationParts>(
    splitDuration(7 * 86400),
  );
  const [unit, setUnit] = useState("шт.");
  const [importJson, setImportJson] = useState("");
  const [formError, setFormError] = useState("");
  const [importError, setImportError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const canEdit = role === "owner" || role === "admin";
  const resetForm = () => {
    setName("");
    setDuration(splitDuration(7 * 86400));
    setUnit("шт.");
    setEditId(null);
    setFormError("");
  };
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    setSuccessMsg("");
    if (
      data?.some(
        (product) =>
          product.productId !== editId &&
          product.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
    ) {
      setFormError("Продукт с таким названием уже есть в каталоге");
      return;
    }
    let shelfLifeSeconds: number;
    try {
      shelfLifeSeconds = durationSeconds(duration);
    } catch (err) {
      setFormError(errorText(err));
      return;
    }
    const parsed = productsDraftSchema.safeParse([
      {
        ...(editId ? { productId: editId } : {}),
        name: name.trim(),
        shelfLifeSeconds,
        unit,
      },
    ]);
    if (!parsed.success) {
      setFormError(errorText(parsed.error));
      return;
    }
    try {
      const editing = editId !== null;
      // Safe POST /products/merge updates or inserts only these records.
      // The backend never deletes any existing products here.
      await save(parsed.data);
      resetForm();
      setShowForm(false);
      setSuccessMsg(editing ? "Продукт обновлён" : "Продукт добавлен");
      await reload().catch(() => {});
    } catch (err) {
      setFormError(errorText(err));
    }
  };
  const handleEdit = (product: Product) => {
    setEditId(product.productId);
    setName(product.name);
    setDuration(splitDuration(product.shelfLifeSeconds));
    setUnit(product.unit);
    setShowForm(true);
    setFormError("");
    setSuccessMsg("");
  };
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileBusy(true);
    setImportError("");
    try {
      if (file.size > 1048576)
        throw new Error("Размер JSON не должен превышать 1 МБ");
      const drafts = productsDraftSchema.parse(JSON.parse(await file.text()));
      setImportJson(JSON.stringify(drafts, null, 2));
    } catch (err) {
      setImportError(errorText(err));
    } finally {
      setFileBusy(false);
    }
  };
  const handleImport = async (event: React.FormEvent) => {
    event.preventDefault();
    setImportError("");
    setSuccessMsg("");
    let drafts: ProductDraft[];
    try {
      if (new Blob([importJson]).size > 1048576)
        throw new Error("Размер JSON не должен превышать 1 МБ");
      drafts = productsDraftSchema.parse(JSON.parse(importJson));
    } catch (err) {
      setImportError(errorText(err));
      return;
    }
    try {
      // Add/update the imported products without replacing the catalog.
      await save(drafts);
      setImportJson("");
      setShowImport(false);
      setSuccessMsg(`Добавлено или обновлено продуктов: ${drafts.length}. Остальные сохранены.`);
      await reload().catch(() => {});
    } catch {
      /* Keep the import text when the API rejects it. */
    }
  };
  const download = async () => {
    setExporting(true);
    setExportError("");
    setSuccessMsg("");
    try {
      // Always read the current catalog from this restaurant's API; a template
      // or an old dashboard snapshot must never be used as export data.
      const products = await inventoryApi.catalog(restaurantId);
      const file = stringifyProductsFile(products);
      const url = URL.createObjectURL(
        new Blob([file], { type: "application/json;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "products.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setSuccessMsg(`Экспортировано продуктов: ${products.length}`);
    } catch (err) {
      setExportError(errorText(err));
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="py-2 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center gap-4 flex-wrap mb-6">
          <h2 className="text-2xl font-bold">Каталог продуктов</h2>
          {canEdit && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                  setSuccessMsg("");
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                + Добавить продукт
              </button>
              <button
                onClick={() => {
                  setShowImport(true);
                  setImportError("");
                }}
                className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
              >
                Импорт JSON
              </button>
              <button
                onClick={() => void download()}
                disabled={exporting}
                className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {exporting ? "Экспорт…" : "Экспортировать продукты JSON"}
              </button>
            </div>
          )}
        </div>
        <ErrorNotice error={error} />
        {exportError && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            Не удалось экспортировать продукты: {exportError}
          </p>
        )}
        {error && (
          <button
            onClick={() => void reload().catch(() => {})}
            className="text-blue-600 mb-4"
          >
            Повторить
          </button>
        )}
        {loading && <p className="text-gray-500 mb-4">Загрузка каталога…</p>}
        {successMsg && (
          <p
            role="status"
            className="bg-green-50 border border-green-200 p-4 rounded mb-6 text-green-700"
          >
            {successMsg}
          </p>
        )}
        {data && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">
                    Название
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">
                    Единица
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">
                    Срок годности
                  </th>
                  {canEdit && (
                    <th className="text-right p-4 text-sm font-medium text-gray-600">
                      Действия
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((product) => (
                  <tr
                    key={product.productId}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="p-4 font-medium">{product.name}</td>
                    <td className="p-4">{unitLabel(product.unit)}</td>
                    <td className="p-4">
                      {durationLabel(product.shelfLifeSeconds)}
                    </td>
                    {canEdit && (
                      <td className="p-4 text-right">
                        <button
                          aria-label={`Редактировать продукт ${product.name}`}
                          onClick={() => handleEdit(product)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Редактировать
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.length && (
              <div className="text-center py-8 text-gray-500">Каталог пуст</div>
            )}
          </div>
        )}
      </div>
      {showForm && (
        <FormDialog
          title={editId ? "Редактировать продукт" : "Новый продукт"}
          onClose={() => setShowForm(false)}
          busy={isSaving}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <fieldset disabled={isSaving} className="space-y-4">
              <div>
                <label
                  htmlFor="product-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Название продукта
                </label>
                <input
                  id="product-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 rounded"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="product-unit"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Единица измерения
                </label>
                <input
                  id="product-unit"
                  list="product-unit-examples"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  maxLength={20}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded"
                />
                <datalist id="product-unit-examples">
                  {["шт.", "г", "кг", "мл", "л"].map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-gray-500">
                  Все количества продукта — в этой единице. Смена подписи не
                  пересчитывает остатки и рецепты.
                </p>
              </div>
              <fieldset aria-describedby="shelf-life-help">
                <legend className="text-sm font-medium text-gray-700 mb-2">
                  Срок хранения
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {durationFields.map(({ key, label, max }) => (
                    <label key={key} className="block text-sm text-gray-700">
                      {label}
                      <input
                        type="number"
                        aria-label={label}
                        min={0}
                        max={max}
                        step={1}
                        required
                        value={duration[key]}
                        onChange={(e) =>
                          setDuration((prev) => ({
                            ...prev,
                            [key]: Number(e.target.value),
                          }))
                        }
                        className="mt-1 w-full min-w-0 px-3 py-2 border border-gray-300 rounded"
                      />
                    </label>
                  ))}
                </div>
                <p id="shelf-life-help" className="mt-2 text-xs text-gray-500">
                  От 1 секунды до 3650 дней. Дата годности уже принятых партий
                  не изменится.
                </p>
              </fieldset>
              {formError && (
                <p role="alert" className="text-red-600 text-sm">
                  {formError}
                </p>
              )}
              <ErrorNotice error={saveError} />
              <div className="flex gap-3">
                <button className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                  {isSaving ? "Сохранение..." : "Сохранить продукт"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
                >
                  Отмена
                </button>
              </div>
            </fieldset>
          </form>
        </FormDialog>
      )}
      {showImport && (
        <FormDialog
          title="Импорт продуктов из JSON"
          onClose={() => setShowImport(false)}
          busy={isSaving || fileBusy}
        >
          <form onSubmit={handleImport} className="space-y-4">
            <fieldset disabled={isSaving || fileBusy} className="space-y-4">
              <p className="text-sm text-gray-600">
                Импорт добавляет или обновляет продукты, но никогда не удаляет остальные.
                Загрузите файл или вставьте массив продуктов. Обязательные поля:
                name и shelfLifeSeconds (срок в секундах), unit — единица
                измерения. Старый shelfLifeDays тоже принимается вместо
                shelfLifeSeconds. productId позволяет обновить существующую
                запись. Если unit нет, сохраняется прежняя единица, у нового
                продукта будет «шт.».
              </p>
              <label className="block text-sm">
                Загрузить каталог JSON
                <input
                  aria-label="Загрузить каталог JSON"
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => void handleFile(e)}
                  className="block mt-2 max-w-full"
                />
              </label>
              <label className="block text-sm">
                JSON продуктов
                <textarea
                  aria-label="JSON продуктов"
                  value={importJson}
                  onChange={(e) => {
                    setImportJson(e.target.value);
                    setImportError("");
                  }}
                  rows={8}
                  required
                  className="block mt-2 w-full border border-gray-300 rounded p-3 font-mono text-sm"
                  placeholder='[{"name":"Молоко","shelfLifeSeconds":604800,"unit":"л"}]'
                />
              </label>
              {importError && (
                <p role="alert" className="text-red-600 text-sm">
                  {importError}
                </p>
              )}
              <ErrorNotice error={saveError} />
              <div className="flex gap-3">
                <button className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                  {isSaving ? "Импорт..." : "Импортировать продукты"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
                >
                  Отмена
                </button>
              </div>
            </fieldset>
          </form>
        </FormDialog>
      )}
    </div>
  );
};
