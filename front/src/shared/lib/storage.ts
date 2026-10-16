import { sessionFromToken } from "./token";
import type { DataMode, Session } from "../types/models";
const KEY = "restaurant.session.v2";
let memorySession: Session | null = null;
export const storage = {
  getAccessToken: () =>
    memorySession?.accessToken || localStorage.getItem("access_token"),
  readSession(mode: DataMode): Session | null {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || saved.dataMode !== mode) {
        this.clearAccessToken();
        return null;
      }
      memorySession = sessionFromToken(saved.accessToken, mode);
      return memorySession;
    } catch {
      this.clearAccessToken();
      return null;
    }
  },
  writeSession(session: Session) {
    memorySession = session;
    localStorage.setItem(KEY, JSON.stringify(session));
    localStorage.setItem("access_token", session.accessToken);
    localStorage.removeItem("auth-storage");
  },
  clearAccessToken() {
    memorySession = null;
    for (const key of [KEY, "access_token", "auth-storage"])
      localStorage.removeItem(key);
  },
  setPendingEmail(email: string, demoCode?: string) {
    sessionStorage.setItem("pending-email", email);
    if (demoCode) sessionStorage.setItem("pending-demo-code", demoCode);
    else sessionStorage.removeItem("pending-demo-code");
  },
  getPendingEmail: () => sessionStorage.getItem("pending-email") || "",
  getDemoCode: () => sessionStorage.getItem("pending-demo-code") || "",
  clearPendingEmail() {
    sessionStorage.removeItem("pending-email");
    sessionStorage.removeItem("pending-demo-code");
  },
  setPendingInvite: (code: string) =>
    sessionStorage.setItem("pending-invite", code),
  getPendingInvite: () => sessionStorage.getItem("pending-invite"),
  clearPendingInvite: () => sessionStorage.removeItem("pending-invite"),
};
