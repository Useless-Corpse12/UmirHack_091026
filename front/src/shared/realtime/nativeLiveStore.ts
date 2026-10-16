import { create } from "zustand";
import type { LiveAnalytics, RealtimeEvent, StockBatch } from "./nativeSignalR";

interface LiveState {
  restaurantId: string;
  status: "connecting" | "connected" | "reconnecting" | "disconnected";
  error: string;
  products: StockBatch[] | null;
  stops: string[] | null;
  recommendations: unknown[] | null;
  analytics: LiveAnalytics | null;
  receivedAt: string;
  selectRestaurant: (id: string) => void;
  updateStatus: (status: LiveState["status"], reason?: string) => void;
  receive: (event: RealtimeEvent) => void;
}

export const useNativeLiveStore = create<LiveState>((set, get) => ({
  restaurantId: "", status: "disconnected", error: "", products: null, stops: null,
  recommendations: null, analytics: null, receivedAt: "",
  selectRestaurant: (id) => set({ restaurantId: id, status: "connecting", error: "",
    products: null, stops: null, recommendations: null, analytics: null, receivedAt: "" }),
  updateStatus: (status, reason) => set({ status, error: reason || "" }),
  receive: (event) => {
    if (!get().restaurantId) return;
    set({ receivedAt: new Date().toISOString(), ...(event.kind === "products" ? { products: event.data } :
      event.kind === "stops" ? { stops: event.data } :
      event.kind === "analytics" ? { analytics: event.data } : { recommendations: event.data }) });
  },
}));
