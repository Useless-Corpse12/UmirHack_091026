/** Minimal ASP.NET Core SignalR JSON protocol client using authenticated Long Polling.
 * The unchanged backend's JwtBearer configuration accepts Authorization headers
 * but does not enable access_token query authorization for browser WebSockets.
 * LongPolling is consequently the compatible SignalR transport.
 * For new projects prefer @microsoft/signalr; this version adds no dependency.
 */
import { storage } from "../lib/storage";
import { parseSupplySignal } from "./incomingSupplies";
import type { IncomingSupply, SupplyMessageMode } from "./incomingSupplies";

export interface StockBatch {
  supplyId: string;
  foodStockId?: string;
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  expiresAt: string;
}
export interface LiveAnalytics { orders: unknown[]; supplies: unknown[]; rot: unknown[] }
export type RealtimeEvent =
  | { kind: "products"; data: StockBatch[] }
  | { kind: "supplies"; data: IncomingSupply[]; mode: SupplyMessageMode }
  | { kind: "stops"; data: string[] }
  | { kind: "recommendations"; data: unknown[] }
  | { kind: "analytics"; data: LiveAnalytics };

const rs = "\u001e";
const base = "/hubs/notifications";
const fail = (r: Response, action: string) => new Error(`${action}: HTTP ${r.status}`);

export class NativeSignalR {
  private abort = new AbortController();
  private id = "";
  private stopped = false;
  private connected = false;
  private buffer = "";
  private handshake: (() => void) | null = null;
  constructor(private restaurantId: string, private event: (e: RealtimeEvent) => void,
    private status: (state: "connecting" | "connected" | "reconnecting" | "disconnected", reason?: string) => void) {}

  private headers(): HeadersInit {
    const token = storage.getAccessToken();
    if (!token) throw new Error("Авторизуйтесь перед подключением к SignalR");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }
  private async request(url: string, init: RequestInit = {}) {
    return fetch(url, { ...init, headers: this.headers(), signal: this.abort.signal, cache: "no-store" });
  }
  private endpoint() { return `${base}?id=${encodeURIComponent(this.id)}`; }
  private async send(message: unknown) {
    const result = await this.request(this.endpoint(), { method: "POST", body: `${JSON.stringify(message)}${rs}` });
    if (!result.ok) throw fail(result, "SignalR send");
  }
  private parse(text: string) {
    this.buffer += text;
    const frames = this.buffer.split(rs);
    this.buffer = frames.pop() || "";
    for (const frame of frames) {
      if (!frame) continue;
      let msg: { type?: number; target?: string; arguments?: unknown[]; error?: string };
      try { msg = JSON.parse(frame) as typeof msg; } catch { continue; }
      if (msg.error) throw new Error(msg.error);
      // Handshake response is {} (not a typed SignalR message).
      if (msg.type === undefined) { this.handshake?.(); this.handshake = null; continue; }
      if (msg.type === 7) throw new Error("SignalR connection closed");
      if (msg.type !== 1 || !msg.target) continue;
      const arg = msg.arguments?.[0];
      if (msg.target === "ProductsUpdated" && Array.isArray(arg)) this.event({ kind: "products", data: arg as StockBatch[] });
      // SupplyIncomingHandler sends manager.supplies([newSupply]) to restaurant_<id>.
      // This is incremental, so never overwrite other pending supply cards.
      const supplyUpdate = parseSupplySignal(msg.target, arg);
      if (supplyUpdate) this.event({ kind: "supplies", ...supplyUpdate });
      if (msg.target === "StopListUpdated" && Array.isArray(arg)) this.event({ kind: "stops", data: arg as string[] });
      if (msg.target === "RecommendationsUpdated" && Array.isArray(arg)) this.event({ kind: "recommendations", data: arg });
      if (msg.target === "AnalyticsUpdated" && arg && typeof arg === "object") {
        const a = arg as Record<string, unknown>;
        this.event({ kind: "analytics", data: {
          orders: Array.isArray(a.orders) ? a.orders : [],
          supplies: Array.isArray(a.supplies) ? a.supplies : [],
          rot: Array.isArray(a.rot) ? a.rot : [],
        } });
      }
    }
  }
  private async poll() {
    while (!this.stopped && !this.abort.signal.aborted) {
      const response = await this.request(this.endpoint());
      if (response.status === 204) throw new Error("Сервер завершил SignalR-соединение");
      if (!response.ok) throw fail(response, "SignalR poll");
      const body = await response.text();
      if (body) this.parse(body);
    }
  }
  private async connect() {
    this.status(this.connected ? "reconnecting" : "connecting");
    const negotiate = await this.request(`${base}/negotiate?negotiateVersion=1`, { method: "POST", body: "" });
    if (!negotiate.ok) throw fail(negotiate, "SignalR negotiate");
    const json = await negotiate.json() as { connectionToken?: string; connectionId?: string };
    this.id = json.connectionToken || json.connectionId || "";
    if (!this.id) throw new Error("SignalR не вернул идентификатор соединения");
    let handshakeOK: () => void = () => {};
    const handshakeDone = new Promise<void>((resolve) => { handshakeOK = resolve; });
    this.handshake = handshakeOK;
    // Poll concurrently so the server can deliver the handshake response.
    const pollTask = this.poll();
    await this.send({ protocol: "json", version: 1 });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        handshakeDone,
        new Promise<never>((_, reject) => { this.abort.signal.addEventListener("abort", () => reject(new Error("SignalR остановлен")), { once: true }); }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Таймаут SignalR handshake")), 12000); }),
        pollTask.then(() => { throw new Error("SignalR отключился во время handshake"); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
    if (this.stopped) return;
    await this.send({ type: 1, target: "JoinRestaurant", arguments: [this.restaurantId] });
    this.connected = true;
    this.status("connected");
    await pollTask;
  }
  async start() {
    let retry = 0;
    while (!this.stopped) {
      this.abort = new AbortController();
      this.buffer = "";
      try { await this.connect(); }
      catch (reason) {
        if (this.stopped) break;
        this.status("disconnected", reason instanceof Error ? reason.message : "Ошибка SignalR");
      } finally { this.abort.abort(); }
      if (this.stopped) break;
      this.status("reconnecting");
      await new Promise((resolve) => setTimeout(resolve, Math.min(15000, 1000 * 2 ** Math.min(retry++, 4))));
    }
  }
  stop() { this.stopped = true; this.abort.abort(); this.status("disconnected"); }
}
