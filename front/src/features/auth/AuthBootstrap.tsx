import { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import { commitSession, resetSession } from "../../shared/api/axios";
import { apiConfig } from "../../shared/api/config";
import { clearMemberships } from "../restaurants/membershipsStore";
import {
  reauthorizeRestaurant,
  stopRestaurant,
} from "../restaurant-runtime/runtimeStore";
import { storage } from "../../shared/lib/storage";
import { watchSessionExpiry } from "../../shared/lib/sessionExpiry";
export function AuthBootstrap() {
  const { session, status } = useAuthStore();
  useEffect(() => {
    if (status !== "restoring" || !session) return;
    if (session.expiresAt > Date.now())
      useAuthStore.getState().setSession(session);
    else resetSession();
  }, [status, session]);
  useEffect(() => {
    if (!session) {
      clearMemberships();
      stopRestaurant();
      return;
    }
    if (status !== "authenticated") return;
    reauthorizeRestaurant();
    return watchSessionExpiry(session.expiresAt, resetSession);
  }, [session, status]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== "restaurant.session.v2") return;
      const session = storage.readSession(apiConfig.mode);
      if (session && session.expiresAt > Date.now()) commitSession(session);
      else resetSession();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return null;
}
