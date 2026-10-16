import { useEffect, useState } from "react";
import { useExpiryApprovals } from "../restaurant-runtime/hooks";
import { ErrorNotice } from "../../shared/ui/Feedback";
import { dateLabel, supplyLabel } from "../../shared/lib/format";

export function ExpiryAlerts() {
  const expiry = useExpiryApprovals();
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const pending = expiry.pending.toSorted(
    (a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt),
  );
  const rows = expanded ? pending : pending.slice(0, 3);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const approve = async (batchId: string) => {
    try {
      const result = await expiry.approve(batchId);
      setMessage(
        "Просрочка подтверждена: " +
          result.productName +
          ", поставка " +
          supplyLabel(result) +
          ". Запись сохранена в истории склада.",
      );
    } catch {
      /* The notice stays visible until the server records approval. */
    }
  };
  return (
    <>
      {pending.length > 0 && (
        <section
          aria-label="Просроченные продукты"
          data-testid="expiry-alerts"
          className="mb-6 border-2 border-red-300 bg-red-50 rounded-lg p-4 md:p-5"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="rounded-full bg-red-600 text-white font-bold w-7 h-7 flex items-center justify-center shrink-0"
            >
              !
            </span>
            <div>
              <h2 className="text-lg font-semibold text-red-900">
                Просроченные продукты
                <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-1 text-sm">
                  Партий: {pending.length}
                </span>
              </h2>
              <p className="text-sm text-red-800 mt-1">
                Они уже исключены из заказов, но остаются на кухне. Проверьте
                партии и уберите испорченные продукты. Уведомление останется,
                пока менеджер не одобрит просрочку.
              </p>
            </div>
          </div>
          <ErrorNotice error={expiry.error} />
          <ul className="mt-4 space-y-3">
            {rows.map((b) => (
              <li
                key={b.batchId}
                className="bg-white border border-red-200 rounded p-3 flex justify-between items-center gap-3 flex-wrap"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {b.productName} — {b.quantity}
                  </p>
                  <p className="text-sm text-gray-600 break-words">
                    Поставка {supplyLabel(b)} · партия {b.batchId.slice(0, 8)}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Срок истёк: {dateLabel(b.expiresAt)}
                  </p>
                </div>
                <button
                  disabled={expiry.isApproving}
                  onClick={() => void approve(b.batchId)}
                  aria-label={
                    "Одобрить просрочку: " +
                    b.productName +
                    ", поставка " +
                    supplyLabel(b)
                  }
                  className="bg-red-700 text-white px-3 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                  Одобрить просрочку
                </button>
              </li>
            ))}
          </ul>
          {pending.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 text-sm font-medium text-red-800 underline"
            >
              {expanded
                ? "Свернуть список"
                : "Показать все партии (" + pending.length + ")"}
            </button>
          )}
        </section>
      )}
      {message && (
        <p
          role="status"
          className="mb-5 rounded bg-green-50 border border-green-200 p-3 text-sm text-green-800"
        >
          {message}
        </p>
      )}
    </>
  );
}
