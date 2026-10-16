import { create } from "zustand";
import { storage } from "../../../shared/lib/storage";
import { apiConfig } from "../../../shared/api/config";
import { observeSession } from "../../../shared/api/axios";
import type { Session } from "../../../shared/types/models";
export type { Role, User } from "../../../shared/types/models";
const initial = storage.readSession(apiConfig.mode);
interface AuthState {
  session: Session | null;
  status: "restoring" | "authenticated" | "anonymous";
  setSession: (session: Session | null) => void;
}
export const useAuthStore = create<AuthState>((set) => ({
  session: initial,
  status: initial ? "restoring" : "anonymous",
  setSession: (session) =>
    set({ session, status: session ? "authenticated" : "anonymous" }),
}));
observeSession((session) => useAuthStore.getState().setSession(session));
