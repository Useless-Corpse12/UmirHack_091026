import type { ApiError } from "../api/errors";
import {
  refreshRestaurant,
  useRestaurantRuntime,
} from "../../features/restaurant-runtime/runtimeStore";
export function ErrorNotice({ error }: { error: ApiError | null | undefined }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="p-3 my-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm"
    >
      {error.message}
      {error.code === "CONTRACT_MISMATCH" && (
        <details className="mt-2">
          <summary>Поля для согласования</summary>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(error.details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
export function SnapshotStatus() {
  const { loading, error, data } = useRestaurantRuntime();
  if (loading && !data)
    return <p className="py-6 text-gray-500">Загрузка данных…</p>;
  if (error)
    return (
      <>
        <ErrorNotice error={error} />
        <button
          className="text-blue-600"
          onClick={() => void refreshRestaurant()}
        >
          Повторить загрузку
        </button>
      </>
    );
  return null;
}
