/** Exact API contract of Useless-Corpse/UmirHack_091026 branch `back`,
 * inspected from the user's (3).zip. No compatibility backend is needed.
 * Unsupported read endpoints are intentionally NOT emulated with fake data.
 */
import { axiosInstance } from "./axios";
import { sessionFromToken } from "../lib/token";
import { storage } from "../lib/storage";
import { apiConfig } from "./config";
import type { Employee, Membership, Role } from "../types/models";

export function currentUserId(): string {
  const token = storage.getAccessToken();
  if (!token) throw new Error("Сначала войдите в аккаунт");
  return sessionFromToken(token, apiConfig.mode).user.id;
}

const roles: Role[] = ["owner", "admin", "manager", "cashier"];
export function normalizeRole(value: unknown): Role {
  if (typeof value === "number" && value >= 0 && value <= 3) return roles[value];
  if (typeof value === "string") {
    const role = value.toLowerCase();
    if (roles.includes(role as Role)) return role as Role;
  }
  throw new Error("Неизвестная роль пользователя в ответе бэкенда");
}

const validGuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const isGuid = validGuid;

export interface NativeDish { dishId: string; name: string }
export interface NativeProductTemplate { name: string; shelfLifeSeconds: number; unit: string }
export interface FactItem { productId: string; factQuantity: number }

export const nativeBackendApi = {
  async memberships(signal?: AbortSignal): Promise<Membership[]> {
    const { data } = await axiosInstance.get<Array<{
      restaurantId: string; restaurantName: string; role: number | string;
      apiKey?: string; // Backend currently returns an API secret/hash; NEVER display or persist it.
    }>>( "/api/Restaurant/GetUserRestaurants", {
      signal, params: { userId: currentUserId() },
    });
    if (!Array.isArray(data)) throw new Error("Бэкенд вернул не список ресторанов");
    return data.map((r) => ({
      restaurantId: r.restaurantId, name: r.restaurantName, role: normalizeRole(r.role),
    }));
  },
  async members(restaurantId: string, signal?: AbortSignal): Promise<Employee[]> {
    const { data } = await axiosInstance.get<Array<{
      userId: string; email: string; role: number | string;
    }>>( "/api/Restaurant/GetRestaurantMembers", { signal, params: { restaurantId } });
    if (!Array.isArray(data)) throw new Error("Бэкенд вернул не список сотрудников");
    return data.map((m) => ({ userId: m.userId, email: m.email, role: normalizeRole(m.role) }));
  },
  async menu(restaurantId: string, signal?: AbortSignal): Promise<NativeDish[]> {
    // Route belongs to POSController, but this is only read-only menu retrieval.
    // No POS interface or cart features are included in the frontend.
    const { data } = await axiosInstance.get<NativeDish[]>("/api/POS/menu", {
      signal, params: { restaurantId },
    });
    if (!Array.isArray(data)) throw new Error("Бэкенд вернул не список блюд");
    return data.map((d) => ({ dishId: d.dishId, name: d.name }));
  },
  async createRestaurant(name: string) {
    const { data } = await axiosInstance.post<{ restaurantId: string; message: string }>(
      "/api/Restaurant/create", { userId: currentUserId(), restaurantName: name },
    );
    return data;
  },
  async acceptInvite(token: string) {
    await axiosInstance.post("/api/Authority/AcceptInvite", { token, userId: currentUserId() });
  },
  async createPOS(restaurantId: string, pincode: string) {
    await axiosInstance.post("/api/Restaurant/CreatePOS", { restaurantId, pincode });
  },
  async deleteRestaurant(restaurantId: string) {
    await axiosInstance.delete("/api/Restaurant/" + encodeURIComponent(restaurantId), {
      params: { userId: currentUserId() },
    });
  },
  async removeMember(restaurantId: string, targetUserId: string) {
    await axiosInstance.delete("/api/Restaurant/RemoveRestaurantMember", {
      params: { userId: currentUserId(), restaurantId, targetUserId },
    });
  },
  async invite(restaurantId: string, email: string, role: "manager" | "admin") {
    // Existing server sends a link on port 5067; recipient can paste its token into frontend invitation form.
    await axiosInstance.post("/api/Restaurant/DirectInvite", {
      restaurantId, email, isAdmin: role === "admin",
    });
  },
  async replaceCatalog(restaurantId: string, products: NativeProductTemplate[]) {
    // DANGER: backend SetProducts executes ExecuteDeleteAsync on ALL restaurant products.
    // Only call after explicit acknowledgement of full, destructive replacement.
    await axiosInstance.post("/api/Restaurant/SetProducts", { restaurantId, products });
  },
  async replaceMenu(restaurantId: string, menu: Record<string, Record<string, number>>) {
    // DANGER: backend LoadRestaurantMenu executes ExecuteDeleteAsync on ALL restaurant dishes.
    await axiosInstance.post("/api/Restaurant/LoadRestaurantMenu", { restaurantId, menu });
  },
  async acceptSupply(supplyId: string, items: FactItem[]) {
    await axiosInstance.post("/api/Supply/AcceptSupply", {
      supplyId, userId: currentUserId(), items,
    });
  },
  async rejectSupply(restaurantId: string, supplyId: string) {
    await axiosInstance.post("/api/Supply/RejectSupply", {
      restaurantId, supplyId, userId: currentUserId(),
    });
  },
};
