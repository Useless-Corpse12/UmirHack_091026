import { create } from "zustand";
import type { LiveAnalytics, RealtimeEvent, StockBatch } from "./nativeSignalR";
import { mergeIncomingSupplies } from "./incomingSupplies";
import type { IncomingSupply } from "./incomingSupplies";

interface LiveState {
  restaurantId: string;
  status: "connecting" | "connected" | "reconnecting" | "disconnected";
  error: string;
  products: StockBatch[] | null;
  supplies: IncomingSupply[] | null;
  processedSupplyIds: string[];
  stops: string[] | null;
  recommendations: unknown[] | null;
  analytics: LiveAnalytics | null;
  receivedAt: string;
  selectRestaurant: (id: string) => void;
  updateStatus: (restaurantId: string, status: LiveState["status"], reason?: string) => void;
  receive: (restaurantId: string, event: RealtimeEvent) => void;
  markSupplyProcessed: (restaurantId: string, supplyId: string) => void;
}

export const useNativeLiveStore = create<LiveState>((set, get) => ({
  restaurantId: "", status: "disconnected", error: "", products: null, supplies: null, processedSupplyIds: [], stops: null,
  recommendations: null, analytics: null, receivedAt: "",
  selectRestaurant: (id) => set({ restaurantId: id, status: "connecting", error: "",
    products: null, supplies: null, processedSupplyIds: [], stops: null, recommendations: null, analytics: null, receivedAt: "" }),
  // A late event from an old connection must not leak into a different restaurant.
  updateStatus: (restaurantId, status, reason) => {
    if (get().restaurantId.toLowerCase() !== restaurantId.toLowerCase()) return;
    set({ status, error: reason || "" });
  },
  receive: (restaurantId, event) => {
    const state = get();
    if (!state.restaurantId || state.restaurantId.toLowerCase() !== restaurantId.toLowerCase()) return;
    if (event.kind === "supplies") {
      const pending = event.data.filter((s) => !state.processedSupplyIds.includes(s.supplyId.toLowerCase()));
      const next = mergeIncomingSupplies(state.supplies, pending, event.mode)
        .filter((s) => !state.processedSupplyIds.includes(s.supplyId.toLowerCase()));
      set({ receivedAt: new Date().toISOString(), supplies: next });
      return;
    }
    set({ receivedAt: new Date().toISOString(), ...(event.kind === "products" ? { products: event.data } :
      event.kind === "stops" ? { stops: event.data } :
      event.kind === "analytics" ? { analytics: event.data } : { recommendations: event.data }) });
  },
  markSupplyProcessed: (restaurantId, supplyId) => {
    const state = get();
    if (state.restaurantId.toLowerCase() !== restaurantId.toLowerCase()) return;
    const key = supplyId.toLowerCase();
    set({ processedSupplyIds: [...new Set([...state.processedSupplyIds, key])],
      supplies: state.supplies?.filter((s) => s.supplyId.toLowerCase() !== key) || null });
  },
}));
