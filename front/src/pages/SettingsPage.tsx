import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRestaurantContext } from "../features/restaurant-runtime/context";
import { useDeleteRestaurant } from "../features/management/useManagement";
import { ErrorNotice } from "../shared/ui/Feedback";

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { restaurantId, name, role } = useRestaurantContext();
  const { remove, isLoading, error } = useDeleteRestaurant();

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const getRoleLabel = (r: string) => {
    switch (r) {
      case "owner":
        return "Владелец";
      case "admin":
        return "Админ";
      case "manager":
        return "Менеджер";
      case "cashier":
        return "Кассир";
      default:
        return r;
    }
  };

  const handleDelete = async () => {
    if (confirmText !== name) return;
    try {
      await remove();
      navigate("/");
    } catch {
      // Ошибка уже в error
    }
  };

  return (
    <div className="py-2 md:p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Настройки ресторана</h2>

        <ErrorNotice error={error} />

        {/* Информация о ресторане */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">Общая информация</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Название</p>
              <p className="font-medium">{name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">ID ресторана</p>
              <p className="font-mono text-sm text-gray-700">{restaurantId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Твоя роль</p>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                {getRoleLabel(role)}
              </span>
            </div>
          </div>
        </div>

        {/* Удаление ресторана - только для owner */}
        {role === "owner" && (
          <div className="bg-white p-6 rounded-lg border border-red-200">
            <h2 className="text-lg font-semibold text-red-700 mb-2">
              Опасная зона
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Удаление ресторана необратимо. Все данные (склад, поставки,
              сотрудники, каталог) будут потеряны.
            </p>

            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Удалить ресторан
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="delete-confirm"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Введите название ресторана для подтверждения:{" "}
                    <strong>{name}</strong>
                  </label>
                  <input
                    id="delete-confirm"
                    aria-label="Название ресторана"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                    placeholder={name}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={isLoading || confirmText !== name}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Удаление..." : "Удалить ресторан навсегда"}
                  </button>
                  <button
                    disabled={isLoading}
                    onClick={() => {
                      setShowConfirm(false);
                      setConfirmText("");
                    }}
                    className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
