import { axiosInstance } from "./axios";
import { apiConfig, endpoints } from "./config";
import { ApiError } from "./errors";
import type { MutationReceipt } from "../types/models";
const ensureDemo = () => {
  if (apiConfig.mode !== "mock")
    throw new ApiError(403, "DEMO_ONLY", "Действие доступно только в демо");
};
export const demoApi = {
  async supply(
    id: string,
    items: { productId: string; quantity: number; expiresAt?: string }[],
  ) {
    ensureDemo();
    return (
      await axiosInstance.post<MutationReceipt>(endpoints.demo(id, "supply"), {
        items,
      })
    ).data;
  },
  async order(
    id: string,
    items: { dishId: string; quantity: number }[],
    key: string,
  ) {
    ensureDemo();
    return (
      await axiosInstance.post<MutationReceipt>(
        endpoints.demo(id, "order"),
        { items },
        { headers: { "Idempotency-Key": key } },
      )
    ).data;
  },
  async advanceTime(id: string, hours: number) {
    ensureDemo();
    await axiosInstance.post(endpoints.demo(id, "advance-time"), { hours });
  },
};
