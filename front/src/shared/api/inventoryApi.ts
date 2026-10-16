import { axiosInstance } from "./axios";
import { endpoints } from "./config";
import {
  decodeProducts,
  decodeSnapshot,
  decodeExpiryReceipt,
  productsDraftSchema,
  decodeMenu,
  menuDraftSchema,
} from "./schemas";
import type { DishDraft, MutationReceipt, ProductDraft } from "../types/models";

export const inventoryApi = {
  async menu(id: string, signal?: AbortSignal) {
    return decodeMenu(
      (await axiosInstance.get(endpoints.menu(id), { signal })).data,
    );
  },
  async saveMenu(id: string, dishes: DishDraft[], version: number) {
    const result = decodeMenu(
      (
        await axiosInstance.put(endpoints.menu(id), {
          version,
          dishes: menuDraftSchema.parse(dishes),
        })
      ).data,
    );
    if (result.restaurantId !== id)
      throw new Error("Сервер вернул меню другого ресторана");
    return result;
  },
  async approveExpiry(restaurantId: string, batchId: string) {
    return decodeExpiryReceipt(
      (
        await axiosInstance.post(
          endpoints.approveExpiry(restaurantId, batchId),
          {},
        )
      ).data,
    );
  },
  async snapshot(id: string, signal?: AbortSignal) {
    return decodeSnapshot(
      (await axiosInstance.get(endpoints.snapshot(id), { signal })).data,
    );
  },
  async catalog(id: string, signal?: AbortSignal) {
    return decodeProducts(
      (await axiosInstance.get(endpoints.products(id), { signal })).data,
    );
  },
  // Incremental upsert. Never drops unrelated rows (unlike full PUT replacement).
  async mergeCatalog(id: string, draft: ProductDraft[]) {
    return decodeProducts(
      (
        await axiosInstance.post(
          endpoints.mergeProducts(id),
          productsDraftSchema.parse(draft),
        )
      ).data,
    );
  },
  async saveCatalog(id: string, draft: ProductDraft[]) {
    return decodeProducts(
      (
        await axiosInstance.put(
          endpoints.products(id),
          productsDraftSchema.parse(draft),
        )
      ).data,
    );
  },
  async decideSupply(
    restaurantId: string,
    supplyId: string,
    decision: "accept" | "reject",
    items?: { productId: string; factQuantity: number }[],
  ) {
    return (
      await axiosInstance.post<MutationReceipt>(
        endpoints.restaurant(restaurantId) + "/supplies/" + encodeURIComponent(supplyId) + "/" + decision,
        { restaurantId, ...(items ? { items } : {}) },
      )
    ).data;
  },
};
