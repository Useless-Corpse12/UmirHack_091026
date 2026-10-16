import { useState, useCallback, useEffect } from "react";
import { useEmployees } from "../features/restaurant-runtime/hooks";
import { useRestaurantContext } from "../features/restaurant-runtime/context";
import { useInvite } from "../features/management/useManagement";
import { apiConfig } from "../shared/api/config";
import { managementApi } from "../shared/api/managementApi";
import { ErrorNotice } from "../shared/ui/Feedback";

const roleLabel: Record<string, string> = {
  owner: "Владелец",
  admin: "Админ",
  manager: "Менеджер",
  cashier: "Кассир",
};
const roleColor: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  manager: "bg-gray-100 text-gray-700",
  cashier: "bg-green-100 text-green-700",
};
export const EmployeesPage = () => {
  const { name, role } = useRestaurantContext();
  const { data, loading, error, reload } = useEmployees();
  const { invite, isLoading: isInviting, error: inviteError } = useInvite();
  const [email, setEmail] = useState("");
  const [inviteAsAdmin, setInviteAsAdmin] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const { restaurantId } = useRestaurantContext();
  const [pendingInvites, setPendingInvites] = useState<{ invitationId: string; email: string; role: string; createdAt: string; expiresAt: string }[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [managementError, setManagementError] = useState("");
  const reloadInvites = useCallback(async () => {
    if (role !== "owner" && role !== "admin") return;
    try { setPendingInvites(await managementApi.invitations(restaurantId)); }
    catch { /* Employees list remains usable if invite retrieval fails. */ }
  }, [restaurantId, role]);
  useEffect(() => { void reloadInvites(); }, [reloadInvites]);
  const remove = async (userId: string) => {
    if (!window.confirm("Удалить сотрудника из ресторана?")) return;
    setDeleting(userId); setManagementError("");
    try { await managementApi.removeEmployee(restaurantId, userId); await reload(); }
    catch (err) { setManagementError(err instanceof Error ? err.message : "Не удалось удалить сотрудника"); }
    finally { setDeleting(null); }
  };
  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const recipient = email.trim().toLowerCase();
    setSuccessMsg("");
    try {
      await invite(
        recipient,
        role === "owner" && inviteAsAdmin ? "admin" : "manager",
      );
      setEmail("");
      await reloadInvites();
      setSuccessMsg(
        apiConfig.mode === "mock"
          ? `Приглашение создано для ${recipient}. В демо письмо не отправляется.`
          : `Приглашение отправлено на ${recipient}.`,
      );
    } catch {
      /* The hook keeps the server error. */
    }
  };
  return (
    <div className="py-2 md:p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Сотрудники</h2>
        <p className="text-gray-600 mb-6">
          Ресторан: {name} · Твоя роль: {roleLabel[role]}
        </p>
        <ErrorNotice error={error} />
        {managementError && <p className="mb-3 text-red-700" role="alert">{managementError}</p>}
        {loading && <p className="mb-4 text-gray-500">Загрузка сотрудников…</p>}
        {error && (
          <button
            onClick={() => void reload().catch(() => {})}
            className="text-blue-600 mb-4"
          >
            Повторить
          </button>
        )}
        {(role === "owner" || role === "admin") && (
          <form
            onSubmit={handleInvite}
            className="bg-white p-6 rounded-lg border border-gray-200 mb-6 space-y-4"
          >
            <h3 className="text-lg font-semibold">Пригласить сотрудника</h3>
            <label
              htmlFor="employee-email"
              className="block text-sm font-medium"
            >
              Email сотрудника
            </label>
            <div className="flex gap-3 flex-wrap">
              <input
                id="employee-email"
                type="email"
                required
                value={email}
                disabled={isInviting}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded"
              />
              <button
                disabled={isInviting}
                className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isInviting ? "Отправка..." : "Отправить приглашение"}
              </button>
            </div>
            {role === "owner" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={inviteAsAdmin}
                  disabled={isInviting}
                  onChange={(e) => setInviteAsAdmin(e.target.checked)}
                />
                Пригласить администратором
              </label>
            )}
            <p className="text-xs text-gray-500">
              Код приглашения одноразовый и привязан к указанному email.
            </p>
            <ErrorNotice error={inviteError} />
            {successMsg && (
              <p role="status" className="text-green-700 text-sm">
                {successMsg}
              </p>
            )}
          </form>
        )}
        {(role === "owner" || role === "admin") && pendingInvites.length > 0 && <section className="mb-5 bg-white border rounded p-5">
          <h3 className="font-semibold mb-3">Ожидающие приглашения</h3>
          {pendingInvites.map((inv) => <p key={inv.invitationId} className="text-sm mb-2">{inv.email} · {roleLabel[inv.role] || inv.role} · до {new Date(inv.expiresAt).toLocaleDateString("ru-RU")}</p>)}
        </section>}
        {data && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">
                    Email
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600">
                    Роль
                  </th>
                  {(role === "owner" || role === "admin") && <th className="text-left p-4 text-sm font-medium text-gray-600">Управление</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((emp) => (
                  <tr
                    key={emp.userId}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="p-4 break-all">{emp.email}</td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${roleColor[emp.role]}`}
                      >
                        {roleLabel[emp.role]}
                      </span>
                    </td>
                    {(role === "owner" || role === "admin") && <td className="p-4">
                      {(role === "owner" && emp.role !== "owner" || role === "admin" && (emp.role === "manager" || emp.role === "cashier")) &&
                        <button disabled={deleting === emp.userId} className="text-red-700 underline disabled:opacity-40" onClick={() => void remove(emp.userId)}>Удалить</button>}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.length && (
              <div className="text-center py-8 text-gray-500">
                Нет сотрудников
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
