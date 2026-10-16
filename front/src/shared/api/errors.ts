import axios from "axios";
export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isCancel(error))
    return new ApiError(0, "CANCELLED", "Запрос отменён");
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 0;
    const body = error.response?.data;
    const fallback =
      status === 404
        ? "Операция ещё недоступна на сервере"
        : status === 401
          ? "Войдите в аккаунт"
          : status === 403
            ? "Недостаточно прав"
            : status === 409
              ? "Данные изменились. Обновите страницу"
              : status === 0
                ? "Не удалось связаться с сервером"
                : "Ошибка запроса";
    return new ApiError(
      status,
      body?.code || "HTTP_" + status,
      body?.message || body?.Message || body?.detail || fallback,
      body?.details || body?.errors,
    );
  }
  return new ApiError(
    0,
    "UNKNOWN",
    error instanceof Error ? error.message : "Неизвестная ошибка",
  );
}
