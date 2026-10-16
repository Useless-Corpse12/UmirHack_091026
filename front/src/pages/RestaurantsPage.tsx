import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRestaurants } from "../features/restaurants/useRestaurants";
import { useAuthStore } from "../features/auth/store/authStore";
import { authApi } from "../shared/api/authApi";
import { ErrorNotice } from "../shared/ui/Feedback";
import { FormDialog } from "../shared/ui/FormDialog";

export const RestaurantsPage = () => {
  const navigate = useNavigate();
  const restaurants = useRestaurants();
  const session = useAuthStore((s) => s.session);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [created, setCreated] = useState<{
    restaurantId: string;
    apiKey?: string;
  } | null>(null);
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await restaurants.create(name.trim());
      setCreated(result);
      setName("");
      setShowCreate(false);
    } catch {
      /* The hook keeps the error and the form stays open. */
    }
  };
  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const member = await restaurants.join(code.trim());
      setCode("");
      setShowJoin(false);
      navigate(member ? "/restaurant/" + member.restaurantId : "/");
    } catch {
      /* The hook keeps the error and the form stays open. */
    }
  };
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Мои рестораны</h1>
            <p className="text-gray-600 break-all">{session?.user.email}</p>
          </div>
          <button
            onClick={() => {
              void authApi.logout();
              navigate("/login");
            }}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Выйти
          </button>
        </div>
        <div className="flex gap-4 flex-wrap mb-6">
          <button
            onClick={() => {
              restaurants.clearCreateError();
              setShowCreate(true);
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
          >
            Создать ресторан
          </button>
          <button
            onClick={() => {
              restaurants.clearJoinError();
              setShowJoin(true);
            }}
            className="bg-white border border-gray-300 px-6 py-3 rounded hover:bg-gray-50"
          >
            Присоединиться по коду
          </button>
        </div>
        {created && (
          <section className="bg-green-50 border border-green-200 rounded p-5 mb-6 space-y-3">
            <h2 className="font-semibold">Ресторан создан</h2>
            <p className="text-sm break-all">
              ID ресторана: {created.restaurantId}
            </p>
            <p className="text-sm break-all">
              {created.apiKey
                ? "Ключ поставщика (показывается один раз): " + created.apiKey
                : "В этой версии API ключ поставщика не возвращается клиенту."}
            </p>
            <button
              onClick={() => setCreated(null)}
              className="text-blue-600 text-sm"
            >
              Я сохранил данные
            </button>
          </section>
        )}
        <ErrorNotice error={restaurants.error} />
        {restaurants.error && (
          <button
            onClick={() => void restaurants.reload().catch(() => {})}
            className="text-blue-600 mb-4"
          >
            Повторить
          </button>
        )}
        {restaurants.isLoading && (
          <p className="text-gray-500 mb-4">Загрузка ресторанов…</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {restaurants.data.map((member) => (
            <div
              key={member.restaurantId}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md relative group"
            >
              <h2 className="text-lg font-semibold">{member.name}</h2>
              <p className="text-sm text-gray-600 mt-2 mb-4">
                Роль: {member.role}
              </p>
              {member.role === "cashier" ? (
                <p className="text-sm text-gray-500">
                  Аккаунт кассы используется в POS-приложении.
                </p>
              ) : (
                <Link
                  to={"/restaurant/" + member.restaurantId}
                  className="text-blue-600 font-medium"
                >
                  Открыть ресторан →
                </Link>
              )}
              {member.role === "owner" && (
                <Link
                  to={"/restaurant/" + member.restaurantId + "/settings"}
                  aria-label={"Удалить ресторан " + member.name}
                  className="absolute top-3 right-3 text-red-600 text-xs hover:text-red-800"
                >
                  Удалить
                </Link>
              )}
            </div>
          ))}
        </div>
        {restaurants.loaded && !restaurants.data.length && (
          <div className="text-center py-12 text-gray-500">
            Нет ресторанов. Создайте свой ресторан.
          </div>
        )}
      </div>
      {showCreate && (
        <FormDialog
          title="Создать ресторан"
          onClose={() => setShowCreate(false)}
          busy={restaurants.isCreating}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <fieldset disabled={restaurants.isCreating} className="space-y-4">
              <label className="block text-sm">
                Название ресторана
                <input
                  aria-label="Название ресторана"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  className="block mt-2 w-full px-4 py-2 border border-gray-300 rounded"
                  autoFocus
                />
              </label>
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">API-ключ для поставщика: текущий бэкенд Useless-Corpse генерирует его самостоятельно в <code>CreateRestaurantHandler</code> и не принимает ручной ключ в <code>CreateRestaurantCommand</code>. Поэтому ручной ввод здесь пока технически невозможен без правки бэкенда. Значение из поля на фронте сервер не сохранил бы.</p>
              <ErrorNotice error={restaurants.createError} />
              <div className="flex gap-3">
                <button className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                  {restaurants.isCreating
                    ? "Создание..."
                    : "Сохранить ресторан"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
                >
                  Отмена
                </button>
              </div>
            </fieldset>
          </form>
        </FormDialog>
      )}
      {showJoin && (
        <FormDialog
          title="Присоединиться по приглашению"
          onClose={() => setShowJoin(false)}
          busy={restaurants.isJoining}
        >
          <form onSubmit={handleJoin} className="space-y-4">
            <fieldset disabled={restaurants.isJoining} className="space-y-4">
              <label className="block text-sm">
                Код приглашения
                <input
                  aria-label="Код приглашения"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="block mt-2 w-full px-4 py-2 border border-gray-300 rounded"
                  autoFocus
                />
              </label>
              <ErrorNotice error={restaurants.joinError} />
              <div className="flex gap-3">
                <button className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                  {restaurants.isJoining
                    ? "Присоединение..."
                    : "Присоединиться"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
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
