import { apiConfig } from "../api/config";
import { decodeSnapshot } from "../api/schemas";
import { ApiError, toApiError } from "../api/errors";
import { storage } from "../lib/storage";
import type { ConnectionState, Snapshot } from "../types/models";

interface Options {
  restaurantId: string;
  onSnapshot: (data: Snapshot) => void;
  onStatus: (status: ConnectionState) => void;
  onError: (error: ApiError) => void;
  beforeReconnect: () => Promise<boolean>;
}
export class RestaurantSocket {
  private options: Options;
  private socket: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private attempts = 0;
  token: string | null = null;
  constructor(options: Options) {
    this.options = options;
  }
  start() {
    this.stopped = false;
    this.connect();
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "Context changed");
  }
  private connect() {
    if (this.stopped) return;
    this.options.onStatus(this.attempts ? "reconnecting" : "connecting");
    const base =
      apiConfig.mode === "mock"
        ? window.location.origin + "/demo-realtime"
        : apiConfig.realtimeURL ||
          new URL("/ws/restaurants", apiConfig.baseURL).href;
    const url = new URL(base, window.location.origin);
    url.protocol =
      url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
    url.searchParams.set("restaurantId", this.options.restaurantId);
    this.token = storage.getAccessToken();
    if (this.token) url.searchParams.set("access_token", this.token);
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      this.options.onError(toApiError(err));
      this.reconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (this.stopped || this.socket !== socket) return;
      this.attempts = 0;
      // Wait for a valid snapshot before reporting a functioning stream.
    };
    socket.onmessage = (event) => {
      if (this.stopped || this.socket !== socket) return;
      try {
        const frame = JSON.parse(event.data);
        if (frame.type !== "restaurant.snapshot") return;
        const data = decodeSnapshot(frame.data);
        if (data.restaurantId !== this.options.restaurantId)
          throw new ApiError(
            0,
            "WRONG_RESTAURANT",
            "Событие относится к другому ресторану",
          );
        this.options.onSnapshot(data);
        this.options.onStatus("connected");
      } catch (err) {
        this.options.onError(toApiError(err));
      }
    };
    socket.onerror = () => {
      if (!this.stopped && this.socket === socket)
        this.options.onError(
          new ApiError(
            0,
            "REALTIME_UNAVAILABLE",
            "Онлайн-обновления недоступны. Последние данные сохранены на экране.",
          ),
        );
    };
    socket.onclose = () => {
      if (!this.stopped && this.socket === socket) this.reconnect();
    };
  }
  private reconnect() {
    if (this.stopped) return;
    this.options.onStatus("reconnecting");
    const delay = Math.min(30000, 500 * 2 ** Math.min(this.attempts++, 6));
    this.timer = setTimeout(async () => {
      this.timer = null;
      const ready = await this.options.beforeReconnect();
      if (this.stopped) return;
      if (ready) this.connect();
      else this.options.onStatus("disconnected");
    }, delay);
  }
}
