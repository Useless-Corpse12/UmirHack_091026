import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAcceptInvite } from "../features/management/useManagement";
import { useAuthStore } from "../features/auth/store/authStore";
import { storage } from "../shared/lib/storage";
import { ErrorNotice } from "../shared/ui/Feedback";
import { apiConfig } from "../shared/api/config";

export const InvitePage = () => {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const { accept, isLoading, error } = useAcceptInvite();
  const { status, session } = useAuthStore();
  useEffect(() => {
    if (code) storage.setPendingInvite(code);
  }, [code]);
  const onAccept = async () => {
    try {
      const member = await accept(code);
      storage.clearPendingInvite();
      navigate("/restaurant/" + member.restaurantId);
    } catch {
      /* The hook keeps the server error. */
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          Приглашение в ресторан
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Вам предложили присоединиться к ресторану
        </p>
        {status === "restoring" ? (
          <p>Восстановление сессии…</p>
        ) : status === "authenticated" ? (
          <>
            <p className="text-sm text-gray-600 mb-5 break-all">
              Вы вошли как {session?.user.email}. Приглашение должно быть
              отправлено на этот email.
            </p>
            <ErrorNotice error={error} />
            {apiConfig.mode === "live" && <p role="alert" className="bg-amber-50 p-3 rounded text-sm mb-3">В текущем бэкенде отсутствует endpoint принятия приглашения. Фронтенд не может выполнить эту операцию без изменения сервера.</p>}
            {apiConfig.mode === "mock" && <button
              onClick={() => void onAccept()}
              disabled={isLoading || !code}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Принятие..." : "Принять приглашение"}
            </button>}
          </>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              Войдите или зарегистрируйтесь с email, на который вас пригласили.
              Приглашение сохранится после подтверждения почты.
            </p>
            <Link className="block text-blue-600 hover:underline" to="/login">
              Войти
            </Link>
            <Link
              className="block text-blue-600 hover:underline"
              to="/register"
            >
              Зарегистрироваться
            </Link>
          </div>
        )}
        <div className="mt-4 text-center">
          <Link to="/" className="text-gray-600 hover:underline text-sm">
            К списку ресторанов
          </Link>
        </div>
      </div>
    </div>
  );
};
