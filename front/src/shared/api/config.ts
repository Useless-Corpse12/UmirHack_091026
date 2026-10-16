import type { DataMode } from "../types/models";

const mode: DataMode =
  import.meta.env.VITE_DATA_MODE === "live" ? "live" : "mock";
export const apiConfig = {
  mode,
  baseURL:
    mode === "mock"
      ? "/demo-api"
      : import.meta.env.VITE_API_URL || window.location.origin,
  logoutPath:
    mode === "mock"
      ? "/api/Authority/Logout"
      : import.meta.env.VITE_LOGOUT_PATH || "",
  realtimeURL: import.meta.env.VITE_REALTIME_URL || "",
  realtimeEnabled: import.meta.env.VITE_ENABLE_REALTIME !== "false",
};
// Integrated C# routes; mock mode remains available only for explicit offline tests.
export const endpoints = {
  register: "/api/Authority/RegisterUser",
  verify: "/api/Authority/VerifyUser",
  login: "/api/Authority/AuthorizeUser",
  resend: "/api/Authority/ResendCode",
  memberships: import.meta.env.VITE_MEMBERSHIPS_PATH || "/api/Restaurant/my",
  createRestaurant: "/api/Restaurant/create",
  createPos: "/api/Restaurant/CreatePOS",
  restaurant: (id: string) => "/api/Restaurant/" + encodeURIComponent(id),
  snapshot: (id: string) => endpoints.restaurant(id) + "/snapshot",
  analytics: (id: string) => endpoints.restaurant(id) + "/analytics",
  products: (id: string) => endpoints.restaurant(id) + "/products",
  mergeProducts: (id: string) => endpoints.products(id) + "/merge",
  menu: (id: string) => endpoints.restaurant(id) + "/menu",
  employees: (id: string) => endpoints.restaurant(id) + "/employees",
  removeEmployee: (id: string, userId: string) => endpoints.employees(id) + "/" + encodeURIComponent(userId),
  invitations: (id: string) => endpoints.restaurant(id) + "/invitations",
  pos: (id: string) => endpoints.restaurant(id) + "/pos",
  acceptInvite:
    import.meta.env.VITE_ACCEPT_INVITE_PATH || "/api/Invitation/accept",
  decideSupply: (id: string, decision: "accept" | "reject") =>
    "/api/Supply/" + encodeURIComponent(id) + "/" + decision,
  approveExpiry: (restaurantId: string, batchId: string) =>
    endpoints.restaurant(restaurantId) +
    "/expiry/" +
    encodeURIComponent(batchId) +
    "/approve",
  demo: (id: string, action: string) =>
    "/api/Demo/" + encodeURIComponent(id) + "/" + action,
};
