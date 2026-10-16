import { axiosInstance } from "./axios";
import { apiConfig, endpoints } from "./config";
import { decodeMembership, decodeMemberships } from "./schemas";
import { nativeBackendApi } from "./nativeBackendApi";
import { storage } from "../lib/storage";
import { sessionFromToken } from "../lib/token";

const actorId = () =>
  sessionFromToken(storage.getAccessToken() || "", apiConfig.mode).user.id;
export const restaurantsApi = {
  async list(signal?: AbortSignal) {
    if (apiConfig.mode === "live") return nativeBackendApi.memberships(signal);
    return decodeMemberships(
      (await axiosInstance.get(endpoints.memberships, { signal })).data,
    );
  },
  async create(name: string) {
    if (apiConfig.mode === "live") return nativeBackendApi.createRestaurant(name);
    // The mock API supports the older shape.
    return (
      await axiosInstance.post<{
        restaurantId: string;
        apiKey?: string;
        message: string;
      }>(endpoints.createRestaurant, {
        userId: actorId(),
        restaurantName: name,
      })
    ).data;
  },
  async remove(id: string) {
    if (apiConfig.mode === "live") return nativeBackendApi.deleteRestaurant(id);
    await axiosInstance.delete(endpoints.restaurant(id), {
      params: { userId: actorId() },
    });
  },
  async acceptInvite(code: string) {
    if (apiConfig.mode === "live") {
      throw new Error("Бэкенд Useless-Corpse не предоставляет API принятия приглашений");
    }
    return decodeMembership(
      (await axiosInstance.post(endpoints.acceptInvite, { code })).data,
    );
  },
};
