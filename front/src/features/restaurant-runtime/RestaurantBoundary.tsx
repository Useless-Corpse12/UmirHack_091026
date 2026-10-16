import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuthStore } from "../auth/store/authStore";
import {
  loadMemberships,
  useMembershipsStore,
} from "../restaurants/membershipsStore";
import { startRestaurant, stopRestaurant } from "./runtimeStore";
import type { Membership } from "../../shared/types/models";
import { RestaurantContext } from "./context";
import { ErrorNotice } from "../../shared/ui/Feedback";
import { apiConfig } from "../../shared/api/config";

function RuntimeMount({
  membership,
  children,
}: {
  membership: Membership;
  children: ReactNode;
}) {
  const userId = useAuthStore((s) => s.session?.user.id);
  useEffect(() => {
    if (apiConfig.mode === "mock") {
      startRestaurant(membership.restaurantId);
      return stopRestaurant;
    }
    return undefined;
  }, [membership.restaurantId, userId]);
  return (
    <RestaurantContext.Provider value={membership}>
      {children}
    </RestaurantContext.Provider>
  );
}
export function RestaurantBoundary({ children }: { children: ReactNode }) {
  const { id } = useParams();
  const userId = useAuthStore((s) => s.session?.user.id);
  const state = useMembershipsStore();
  useEffect(() => {
    void loadMemberships().catch(() => {});
  }, [userId]);
  if (state.userId !== userId || (!state.loaded && !state.error))
    return <p className="p-8">Загрузка ресторанов…</p>;
  if (state.error)
    return (
      <div className="p-8">
        <ErrorNotice error={state.error} />
        <button onClick={() => void loadMemberships(true).catch(() => {})}>
          Повторить
        </button>
      </div>
    );
  const membership = state.items.find(
    (r) =>
      r.restaurantId === id && ["owner", "admin", "manager"].includes(r.role),
  );
  if (!membership)
    return (
      <div className="p-8">
        Нет доступа к этому ресторану. <Link to="/">Мои рестораны</Link>
      </div>
    );
  return <RuntimeMount membership={membership}>{children}</RuntimeMount>;
}
