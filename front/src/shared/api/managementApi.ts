import { axiosInstance } from "./axios";
import { endpoints } from "./config";
import { decodeEmployees, decodePoints } from "./schemas";
import type { InviteRole } from "../types/models";

export const managementApi = {
  async employees(id: string, signal?: AbortSignal) {
    return decodeEmployees(
      (await axiosInstance.get(endpoints.employees(id), { signal })).data,
    );
  },
  async removeEmployee(id: string, userId: string) {
    await axiosInstance.delete(endpoints.removeEmployee(id, userId));
  },
  async invitations(id: string) {
    const { data } = await axiosInstance.get<{ invitationId: string; email: string; role: string; createdAt: string; expiresAt: string }[]>(endpoints.invitations(id));
    return data;
  },
  async invite(id: string, email: string, role: InviteRole = "manager") {
    await axiosInstance.post(endpoints.invitations(id), { email, role });
  },
  async points(id: string, signal?: AbortSignal) {
    return decodePoints(
      (await axiosInstance.get(endpoints.pos(id), { signal })).data,
    );
  },
  async createPoint(id: string, pincode: string) {
    return (
      await axiosInstance.post<{ message: string; posId?: string }>(
        endpoints.createPos,
        { restaurantId: id, pincode },
      )
    ).data;
  },
};
