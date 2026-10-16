import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useRegister } from "../features/auth/useAuthActions";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { registerUser, isLoading, error } = useRegister();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (password.length < 8) {
      setSubmitError("Пароль должен содержать минимум 8 символов");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Пароли не совпадают");
      return;
    }
    try {
      await registerUser({ email: email.trim().toLowerCase(), password });
      navigate("/verify-email");
    } catch {
      /* The hook keeps the server error. */
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-8">Регистрация</h1>
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
              className="w-full px-4 py-2 border border-gray-300 rounded"
              placeholder="test@example.com"
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
              className="w-full px-4 py-2 border border-gray-300 rounded"
              placeholder="Минимум 8 символов"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Подтвердите пароль
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>
          {(submitError || error) && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 p-3 rounded"
            >
              <p className="text-sm text-red-700">
                {submitError || error?.message}
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Регистрация..." : "Зарегистрироваться"}
          </button>
        </form>
        <div className="mt-6 text-center">
          <Link to="/login" className="text-blue-600 hover:underline text-sm">
            Уже есть аккаунт? Войти
          </Link>
        </div>
      </div>
    </div>
  );
};
