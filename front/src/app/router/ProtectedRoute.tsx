import { Navigate, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../../features/auth/store/authStore";
import { useRestaurantContext } from "../../features/restaurant-runtime/context";
import type { Role } from "../../shared/types/models";
export const ProtectedRoute = ({ children }: { children?: ReactNode }) => {
  const status = useAuthStore((s) => s.status);
  if (status === "restoring")
    return <p className="p-8">Восстановление сессии…</p>;
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  return children ? <>{children}</> : <Outlet />;
};
export function RestaurantRoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children: ReactNode;
}) {
  const { restaurantId, role } = useRestaurantContext();
  if (!allowedRoles.includes(role))
    return (
      <Navigate to={"/restaurant/" + restaurantId + "/dashboard"} replace />
    );
  return <>{children}</>;
}
