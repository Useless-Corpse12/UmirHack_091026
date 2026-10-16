import { create } from "zustand";
import { restaurantsApi } from "../../shared/api/restaurantsApi";
import { toApiError } from "../../shared/api/errors";
import type { ApiError } from "../../shared/api/errors";
import type { Membership } from "../../shared/types/models";
import { useAuthStore } from "../auth/store/authStore";

interface State {
  userId: string | null;
  items: Membership[];
  loaded: boolean;
  loading: boolean;
  error: ApiError | null;
}
export const useMembershipsStore = create<State>(() => ({
  userId: null,
  items: [],
  loaded: false,
  loading: false,
  error: null,
}));
let flight: Promise<Membership[]> | null = null;
let controller: AbortController | null = null;
let epoch = 0;
export function clearMemberships() {
  epoch += 1;
  controller?.abort();
  flight = null;
  useMembershipsStore.setState({
    userId: null,
    items: [],
    loaded: false,
    loading: false,
    error: null,
  });
}
export async function loadMemberships(force = false): Promise<Membership[]> {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) return [];
  const state = useMembershipsStore.getState();
  if (state.userId === userId && state.loaded && !force) return state.items;
  if (flight && state.userId === userId) {
    if (!force) return flight;
    try {
      await flight;
    } catch {
      /* Force another attempt after a failed request. */
    }
  }
  controller?.abort();
  const current = ++epoch;
  controller = new AbortController();
  useMembershipsStore.setState({
    userId,
    items: state.userId === userId ? state.items : [],
    loaded: false,
    loading: true,
    error: null,
  });
  const task = restaurantsApi
    .list(controller.signal)
    .then((items) => {
      if (
        current === epoch &&
        useAuthStore.getState().session?.user.id === userId
      ) {
        useMembershipsStore.setState({ items, loaded: true, loading: false });
      }
      return items;
    })
    .catch((err) => {
      const error = toApiError(err);
      if (current === epoch)
        useMembershipsStore.setState({ loading: false, error });
      throw error;
    })
    .finally(() => {
      if (flight === task) flight = null;
    });
  flight = task;
  return task;
}
