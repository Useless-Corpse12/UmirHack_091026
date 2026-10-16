import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/store/authStore";
import { useRestaurantContext } from "../features/restaurant-runtime/context";
import {
  refreshRestaurant,
  useRestaurantRuntime,
} from "../features/restaurant-runtime/runtimeStore";
import { authApi } from "../shared/api/services";
import { ErrorNotice } from "../shared/ui/Feedback";
import { dateLabel } from "../shared/lib/format";
import { ExpiryAlerts } from "../features/expiry/ExpiryAlerts";
import { useDashboard } from "../features/restaurant-runtime/hooks";
export const RestaurantDetailPage = () => {
  const membership = useRestaurantContext();
  const user = useAuthStore((s) => s.session?.user);
  const navigate = useNavigate();
  const { connection, realtimeError } = useRestaurantRuntime();
  const data = useDashboard();
  const tabs = [
    { name: "Обзор", path: "dashboard" },
    { name: "Аналитика", path: "analytics" },
    { name: "Склад", path: "warehouse" },
    { name: "Приёмка", path: "deliveries" },
    ...(["owner", "admin"].includes(membership.role)
      ? [
          { name: "Сотрудники", path: "employees" },
          { name: "Продукты", path: "products" },
          { name: "Меню", path: "menu" },
        ]
      : []),
    ...(membership.role === "owner"
      ? [{ name: "Настройки", path: "settings" }]
      : []),
  ];
  const status = {
    idle: "Не подключено",
    connecting: "Подключение…",
    connected: "Онлайн",
    reconnecting: "Переподключение…",
    disconnected: "Нет онлайн-обновлений",
  }[connection];
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between mb-2 gap-4">
            <button
              className="text-blue-600 text-sm"
              onClick={() => navigate("/")}
            >
              ← Назад к ресторанам
            </button>
            <button
              className="bg-red-600 text-white px-4 py-2 rounded text-sm"
              onClick={() => {
                void authApi.logout();
                navigate("/login");
              }}
            >
              Выйти
            </button>
          </div>
          <h1 className="text-2xl font-bold">{membership.name}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {user?.email} · Роль в ресторане: {membership.role}
          </p>
          <div className="text-xs mt-3 flex gap-4 flex-wrap items-center">
            <span
              data-testid="connection"
              className={
                connection === "connected"
                  ? "text-green-700"
                  : "text-orange-700"
              }
            >
              {status}
            </span>
            {data && (
              <span>
                Обновлено: {dateLabel(data.generatedAt)} · Версия{" "}
                {data.revision}
              </span>
            )}
            <button
              className="text-blue-600"
              onClick={() => void refreshRestaurant()}
            >
              Обновить данные
            </button>
          </div>
          <ErrorNotice error={realtimeError} />
        </div>
      </header>
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                "py-4 whitespace-nowrap text-sm font-medium border-b-2 " +
                (isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500")
              }
            >
              {tab.name}
              {tab.path === "deliveries" && !!data?.metrics.pendingSupplies && (
                <span
                  data-testid="supplies-badge"
                  className="ml-2 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-xs"
                  aria-label={
                    "ожидают решения: " + data.metrics.pendingSupplies
                  }
                >
                  {data.metrics.pendingSupplies}
                </span>
              )}
              {tab.path === "warehouse" && !!data?.metrics.expiredBatches && (
                <span
                  data-testid="expiry-badge"
                  className="ml-2 rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-xs"
                  aria-label={
                    "просрочены, требуют подтверждения: " +
                    data.metrics.expiredBatches
                  }
                >
                  {data.metrics.expiredBatches}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <ExpiryAlerts key={membership.restaurantId} />
        <Outlet key={membership.restaurantId} />
      </main>
    </div>
  );
};
