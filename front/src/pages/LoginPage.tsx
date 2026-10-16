import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLogin } from "../features/auth/useAuthActions";
import { storage } from "../shared/lib/storage";
import { ApiError } from "../shared/api/errors";
import { apiConfig } from "../shared/api/config";
import type { Credentials } from "../shared/types/models";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginWithCredentials = async (credentials: Credentials) => {
    try {
      await login(credentials);
      const invite = storage.getPendingInvite();
      navigate(invite ? "/invite/" + encodeURIComponent(invite) : "/");
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_UNVERIFIED") {
        const recipient = credentials.email;
        storage.setPendingEmail(
          recipient,
          storage.getPendingEmail() === recipient
            ? storage.getDemoCode()
            : undefined,
        );
        navigate("/verify-email");
      }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithCredentials({ email: email.trim().toLowerCase(), password });
  };

  const onDemoLogin = async () => {
    // The demo API authenticates with email/password and issues its own JWT.
    // Never send these sample credentials to the live backend.
    if (apiConfig.mode !== "mock") return;
    setEmail("owner@demo.test");
    setPassword("Demo123!");
    await loginWithCredentials({ email: "owner@demo.test", password: "Demo123!" });
  };

  const backendRequiresToken =
    apiConfig.mode === "live" &&
    !!error &&
    /access[\s_-]*token|bearer|jwt|токен/i.test(error.message);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-5">Вход в систему</h1>

        {apiConfig.mode === "mock" && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-medium">Демонстрационный режим</p>
            <p className="mt-1">
              Токен вручную вводить не нужно — демо-сервер выдаст его после входа.
            </p>
            <button
              type="button"
              onClick={onDemoLogin}
              disabled={isLoading}
              className="mt-3 w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Войти как владелец (демо)
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-md"
            >
              <p className="text-sm text-red-700">
                {typeof error === "string"
                  ? error
                  : error?.message || "Ошибка входа"}
              </p>
              {backendRequiresToken && (
                <p className="mt-2 text-sm text-red-700">
                  Реальный сервер требует JWT даже на маршруте входа.
                  /api/Authority/AuthorizeUser должен принимать email и пароль
                  без заголовка Authorization; это нужно исправить на бэкенде.
                </p>
              )}
              {apiConfig.mode === "mock" && error.status === 0 && (
                <p className="mt-2 text-sm text-red-700">
                  Демо API недоступен. Запустите обе части командой
                  <code className="mx-1 font-semibold">npm run dev</code>
                  (не отдельно vite / npm run dev:live).
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {isLoading ? "Вход..." : "Войти"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/register"
            className="text-blue-600 hover:underline text-sm"
          >
            Зарегистрироваться
          </Link>
        </div>
      </div>
    </div>
  );
};
