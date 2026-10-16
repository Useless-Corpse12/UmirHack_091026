import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useVerifyEmail, useResendCode } from "../features/auth/useAuthActions";
import { storage } from "../shared/lib/storage";
import { apiConfig } from "../shared/api/config";
import { ErrorNotice } from "../shared/ui/Feedback";

export const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const { verify, isLoading, error } = useVerifyEmail();
  const {
    resend,
    isLoading: isResending,
    error: resendError,
  } = useResendCode();
  const [email] = useState(storage.getPendingEmail);
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState(storage.getDemoCode);
  const [successMsg, setSuccessMsg] = useState("");
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMsg("");
    try {
      await verify(email, code.trim());
      navigate("/login");
    } catch {
      /* The hook keeps the server error. */
    }
  };
  const handleResend = async () => {
    setSuccessMsg("");
    try {
      await resend(email);
      setDemoCode(storage.getDemoCode());
      setSuccessMsg(
        apiConfig.mode === "mock"
          ? "Новый код создан для проверки"
          : "Код отправлен повторно",
      );
    } catch {
      /* The hook keeps the server error. */
    }
  };
  if (!email) return <Navigate to="/register" replace />;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          Подтверждение почты
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Введите код для <span className="font-medium break-all">{email}</span>
        </p>
        {apiConfig.mode === "mock" && demoCode && (
          <p
            data-testid="demo-code"
            className="bg-amber-50 p-3 mb-4 rounded text-sm"
          >
            Демокод: <strong>{demoCode}</strong>. Он также выведен в консоль
            локального сервиса.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Код подтверждения
            </label>
            <input
              id="code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded font-mono text-center text-lg tracking-widest"
              placeholder="123456"
              autoFocus
            />
          </div>
          <ErrorNotice error={error || resendError} />
          {successMsg && (
            <p
              role="status"
              className="bg-green-50 border border-green-200 p-3 rounded text-sm text-green-700"
            >
              {successMsg}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading || isResending || code.length !== 6}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Проверка..." : "Подтвердить"}
          </button>
        </form>
        <div className="mt-6 text-center space-y-3">
          {apiConfig.mode === "live" && (
            <p className="text-sm text-gray-600">Если код истёк, откройте регистрацию и зарегистрируйтесь с тем же email и паролем: сервер создаст новый код.</p>
          )}
          {apiConfig.mode === "mock" && <button
            onClick={() => void handleResend()}
            disabled={isResending || isLoading}
            className="text-blue-600 hover:underline text-sm disabled:opacity-50"
          >
            {isResending ? "Отправка..." : "Отправить код повторно"}
          </button>}
          <Link
            className="block text-gray-600 text-sm hover:underline"
            to="/register"
          >
            Вернуться к регистрации
          </Link>
        </div>
      </div>
    </div>
  );
};
