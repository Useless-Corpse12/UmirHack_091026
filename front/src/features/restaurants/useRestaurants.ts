import { useEffect } from "react";
import { useAuthStore } from "../auth/store/authStore";
import { useMembershipsStore, loadMemberships } from "./membershipsStore";
import { restaurantsApi } from "../../shared/api/restaurantsApi";
import { useMutation } from "../../shared/lib/useMutation";
export function useRestaurants() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const state = useMembershipsStore();
  useEffect(() => {
    void loadMemberships().catch(() => {});
  }, [userId]);
  const create = useMutation(async (name: string) => {
    const result = await restaurantsApi.create(name);
    await loadMemberships(true).catch(() => {});
    return result;
  });
  const join = useMutation(async (code: string) => {
    const result = await restaurantsApi.acceptInvite(code);
    await loadMemberships(true).catch(() => {});
    return result;
  });
  const remove = useMutation(async (id: string) => {
    await restaurantsApi.remove(id);
    await loadMemberships(true).catch(() => {});
  });
  return {
    data: state.userId === userId ? state.items : [],
    loaded: state.userId === userId && state.loaded,
    isLoading: state.loading,
    error: state.error,
    reload: () => loadMemberships(true),
    clearCreateError: create.clearError,
    clearJoinError: join.clearError,
    create: create.run,
    isCreating: create.isLoading,
    createError: create.error,
    join: join.run,
    isJoining: join.isLoading,
    joinError: join.error,
    remove: remove.run,
    isRemoving: remove.isLoading,
    removeError: remove.error,
  };
}
