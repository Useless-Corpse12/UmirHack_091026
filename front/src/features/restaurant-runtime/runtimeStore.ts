import { create } from "zustand";
import { inventoryApi } from "../../shared/api/inventoryApi";
import { apiConfig } from "../../shared/api/config";
import { ApiError, toApiError } from "../../shared/api/errors";
import type { ConnectionState, Snapshot } from "../../shared/types/models";
import { RestaurantSocket } from "../../shared/realtime/restaurantSocket";
import { storage } from "../../shared/lib/storage";
import { chooseSnapshot } from "./snapshotPolicy";

interface State {
  restaurantId: string | null;
  data: Snapshot | null;
  loading: boolean;
  error: ApiError | null;
  realtimeError: ApiError | null;
  connection: ConnectionState;
}
const empty: State = {
  restaurantId: null,
  data: null,
  loading: false,
  error: null,
  realtimeError: null,
  connection: "idle",
};
export const useRestaurantRuntime = create<State>(() => ({ ...empty }));
let epoch = 0;
let controller: AbortController | null = null;
let socket: RestaurantSocket | null = null;
let refreshFlight: Promise<boolean> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
function applySnapshot(data: Snapshot, current: number) {
  const state = useRestaurantRuntime.getState();
  if (current !== epoch || !state.restaurantId) return;
  const next = chooseSnapshot(state.data, data, state.restaurantId);
  if (next !== state.data)
    useRestaurantRuntime.setState({ data: next, loading: false, error: null });
}
function connect(current: number, id: string) {
  if (!apiConfig.realtimeEnabled) {
    useRestaurantRuntime.setState({ connection: "disconnected" });
    return;
  }
  socket = new RestaurantSocket({
    restaurantId: id,
    onSnapshot: (data) => {
      applySnapshot(data, current);
      if (current === epoch)
        useRestaurantRuntime.setState({ realtimeError: null });
    },
    onStatus: (connection) => {
      if (current === epoch) useRestaurantRuntime.setState({ connection });
    },
    onError: (realtimeError) => {
      if (current === epoch) useRestaurantRuntime.setState({ realtimeError });
    },
    beforeReconnect: () => refreshRestaurant(),
  });
  socket.start();
}
export function stopRestaurant() {
  epoch += 1;
  controller?.abort();
  controller = null;
  socket?.stop();
  socket = null;
  refreshFlight = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  useRestaurantRuntime.setState({ ...empty });
}
export function startRestaurant(id: string) {
  stopRestaurant();
  const current = epoch;
  useRestaurantRuntime.setState({ restaurantId: id, loading: true });
  void refreshRestaurant();
  connect(current, id);
  // The backend exposes SignalR, not the older raw /ws/restaurants protocol.
  // Until a SignalR client is installed, refresh safely every 20 seconds.
  if (apiConfig.mode === "live" && !apiConfig.realtimeEnabled) {
    pollTimer = setInterval(() => { if (current === epoch) void refreshRestaurant(); }, 20000);
  }
}
export function reauthorizeRestaurant() {
  const id = useRestaurantRuntime.getState().restaurantId;
  if (id && socket && socket.token !== storage.getAccessToken()) {
    socket.stop();
    connect(epoch, id);
  }
}
export async function refreshRestaurant(force = false): Promise<boolean> {
  const id = useRestaurantRuntime.getState().restaurantId;
  if (!id) return false;
  if (refreshFlight) {
    if (!force) return refreshFlight;
    await refreshFlight;
    if (useRestaurantRuntime.getState().restaurantId !== id) return false;
    if (refreshFlight) return refreshFlight;
  }
  const current = epoch;
  controller = new AbortController();
  const task = inventoryApi
    .snapshot(id, controller.signal)
    .then((data) => {
      if (data.restaurantId !== id)
        throw new ApiError(
          0,
          "WRONG_RESTAURANT",
          "Сервер вернул данные другого ресторана",
        );
      applySnapshot(data, current);
      return current === epoch;
    })
    .catch((err) => {
      const error = toApiError(err);
      if (current === epoch && error.code !== "CANCELLED") {
        const denied = [401, 403, 404].includes(error.status);
        useRestaurantRuntime.setState({
          error,
          loading: false,
          ...(denied
            ? { data: null, connection: "disconnected" as const }
            : {}),
        });
        if (denied) socket?.stop();
      }
      return false;
    })
    .finally(() => {
      if (refreshFlight === task) refreshFlight = null;
    });
  refreshFlight = task;
  return task;
}
