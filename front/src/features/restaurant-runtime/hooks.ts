import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRestaurantContext } from "./context";
import { useRestaurantRuntime } from "./runtimeStore";
import { useAuthStore } from "../auth/store/authStore";
import { ApiError, toApiError } from "../../shared/api/errors";
import { inventoryApi } from "../../shared/api/inventoryApi";
import { managementApi } from "../../shared/api/managementApi";
import { useMutation } from "../../shared/lib/useMutation";
import type { DishDraft, ProductDraft, SupplyItem } from "../../shared/types/models";
import { refreshRestaurant } from "./runtimeStore";

export const useDashboard = () => {
  const { restaurantId } = useRestaurantContext();
  const data = useRestaurantRuntime((s) => s.data);
  return data?.restaurantId === restaurantId ? data : null;
};
export const useWarehouse = () => useDashboard()?.batches;
export const useRestaurantDashboard = useDashboard;

export function useMenu() {
  const { restaurantId } = useRestaurantContext();
  const snapshot = useDashboard();
  const runtime = useRestaurantRuntime();
  const data = useMemo(
    () =>
      snapshot && snapshot.menuVersion !== undefined
        ? {
            restaurantId,
            version: snapshot.menuVersion,
            dishes: snapshot.menu.map(({ dishId, name, recipe }) => ({
              dishId,
              name,
              recipe,
            })),
          }
        : null,
    [snapshot, restaurantId],
  );
  const action = useMutation(async (dishes: DishDraft[], version: number) => {
    try {
      const result = await inventoryApi.saveMenu(restaurantId, dishes, version);
      await refreshRestaurant(true);
      return result;
    } catch (err) {
      await refreshRestaurant(true);
      throw err;
    }
  });
  return {
    data,
    catalog: snapshot?.catalog || [],
    loading: runtime.loading,
    error:
      runtime.error ||
      (snapshot && !data
        ? new ApiError(
            0,
            "MENU_VERSION_MISSING",
            "Сервер не передал версию меню. Нужен menuVersion в snapshot",
          )
        : null),
    reload: () => refreshRestaurant(true),
    save: action.run,
    isSaving: action.isLoading,
    saveError: action.error,
    clearSaveError: action.clearError,
  };
}

export function useExpiryApprovals() {
  const { restaurantId } = useRestaurantContext();
  const data = useDashboard();
  const action = useMutation(async (batchId: string) => {
    try {
      const result = await inventoryApi.approveExpiry(restaurantId, batchId);
      await refreshRestaurant(true);
      return result.approval;
    } catch (err) {
      const error = toApiError(err);
      if (error.status === 0 || error.status >= 500 || error.status === 409) {
        await refreshRestaurant(true);
        const state = useRestaurantRuntime.getState().data;
        const approved =
          state?.restaurantId === restaurantId &&
          state.expiryApprovals.find((a) => a.batchId === batchId);
        if (approved) return approved;
      }
      throw error;
    }
  });
  return {
    pending: data?.batches.filter((b) => b.expiryStatus === "expired" && b.quantity > 0 && !data.expiryApprovals.some(a => a.batchId === b.batchId)) || [],
    history: data?.expiryApprovals || [],
    approve: action.run,
    isApproving: action.isLoading,
    error: action.error,
    clearError: action.clearError,
  };
}
export function useDeliveries() {
  const { restaurantId } = useRestaurantContext();
  const data = useDashboard()?.supplies;
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const pending = useRef(new Set<string>());
  const [errors, setErrors] = useState<Record<string, ApiError | null>>({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const decide = async (id: string, decision: "accept" | "reject", items?: SupplyItem[]) => {
    if (pending.current.has(id)) return;
    pending.current.add(id);
    setPendingIds([...pending.current]);
    setErrors((s) => ({ ...s, [id]: null }));
    try {
      await inventoryApi.decideSupply(restaurantId, id, decision,
        decision === "accept" && items ? items.map((item) => ({
          productId: item.productId, factQuantity: item.factQuantity ?? item.quantity,
        })) : undefined);
      await refreshRestaurant(true);
    } catch (err) {
      const error = toApiError(err);
      // A lost response may follow a successful command. Re-read the confirmed state before a retry.
      if (error.status === 0 || error.status >= 500 || error.status === 409) {
        await refreshRestaurant(true);
        const supply = useRestaurantRuntime
          .getState()
          .data?.supplies.find((s) => s.supplyId === id);
        if (
          (decision === "accept"
            ? supply?.status === "accepted" || supply?.status === "partial"
            : supply?.status === "rejected")
        )
          return;
      }
      if (mounted.current) setErrors((s) => ({ ...s, [id]: error }));
      throw error;
    } finally {
      pending.current.delete(id);
      if (mounted.current) setPendingIds([...pending.current]);
    }
  };
  return {
    data,
    pendingIds,
    errors,
    accept: (id: string, items?: SupplyItem[]) => decide(id, "accept", items),
    reject: (id: string) => decide(id, "reject"),
  };
}

export function useRestaurantResource<T>(
  loader: (id: string, signal?: AbortSignal) => Promise<T>,
) {
  const { restaurantId } = useRestaurantContext();
  const userId = useAuthStore((s) => s.session?.user.id);
  const key = userId + ":" + restaurantId;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    loading: boolean;
    error: ApiError | null;
  }>({ key, data: null, loading: true, error: null });
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    controller.current?.abort();
    controller.current = new AbortController();
    const current = ++epoch.current;
    setState((prev) => ({
      key,
      data: prev.key === key ? prev.data : null,
      loading: true,
      error: null,
    }));
    try {
      const data = await loader(restaurantId, controller.current.signal);
      if (current === epoch.current)
        setState({ key, data, loading: false, error: null });
      return data;
    } catch (err) {
      const error = toApiError(err);
      if (current === epoch.current && error.code !== "CANCELLED")
        setState((s) => ({ ...s, loading: false, error }));
      throw error;
    }
  }, [restaurantId, key, loader]);
  const cancel = useCallback(() => {
    ++epoch.current;
    controller.current?.abort();
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void reload().catch(() => {});
    });
    return () => {
      active = false;
      cancel();
    };
  }, [reload, cancel]);
  return {
    data: state.key === key ? state.data : null,
    loading: state.key === key ? state.loading : true,
    error: state.key === key ? state.error : null,
    reload,
  };
}
export function useCatalog() {
  const { restaurantId } = useRestaurantContext();
  const snapshot = useDashboard();
  const runtime = useRestaurantRuntime();
  const action = useMutation(async (draft: ProductDraft[]) => {
    const result = await inventoryApi.mergeCatalog(restaurantId, draft);
    await refreshRestaurant(true);
    return result;
  });
  return {
    data: snapshot?.catalog ?? null,
    loading: runtime.loading,
    error: runtime.error,
    reload: () => refreshRestaurant(true),
    save: action.run,
    isSaving: action.isLoading,
    saveError: action.error,
  };
}
export const useEmployees = () =>
  useRestaurantResource(managementApi.employees);
export function usePosPoints() {
  const { restaurantId } = useRestaurantContext();
  const resource = useRestaurantResource(managementApi.points);
  const action = useMutation(async (pin: string) => {
    const result = await managementApi.createPoint(restaurantId, pin);
    await resource.reload().catch(() => {});
    return result;
  });
  return {
    ...resource,
    create: action.run,
    isCreating: action.isLoading,
    createError: action.error,
  };
}
