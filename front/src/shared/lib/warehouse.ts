import type { Batch, Product } from "../types/models.ts";

export interface WarehouseProduct {
  productId: string;
  productName: string;
  unit: string;
  totalQuantity: number;
  availableQuantity: number;
  expiredQuantity: number;
  nextExpiresAt: string | null;
  nextExpiryQuantity: number;
  batchCount: number;
}

/** Uses the server's expiry status. Pending supplies never enter this input. */
export function aggregateWarehouse(
  batches: Batch[],
  catalog: Product[],
): WarehouseProduct[] {
  const products = new Map(catalog.map((p) => [p.productId, p]));
  const groups = new Map<string, WarehouseProduct>();
  for (const product of catalog) {
    groups.set(product.productId, {
      productId: product.productId,
      productName: product.name,
      unit: product.unit,
      totalQuantity: 0,
      availableQuantity: 0,
      expiredQuantity: 0,
      nextExpiresAt: null,
      nextExpiryQuantity: 0,
      batchCount: 0,
    });
  }
  // Integer thousandths avoid 0.1 + 0.2 artefacts; divide once after summing.
  for (const batch of batches) {
    if (batch.quantity <= 0) continue;
    const product = products.get(batch.productId);
    let row = groups.get(batch.productId);
    if (!row) {
      row = {
        productId: batch.productId,
        productName: product?.name || batch.productName,
        unit: product?.unit || "",
        totalQuantity: 0,
        availableQuantity: 0,
        expiredQuantity: 0,
        nextExpiresAt: null,
        nextExpiryQuantity: 0,
        batchCount: 0,
      };
      groups.set(batch.productId, row);
    }
    const quantity = Math.round(batch.quantity * 1000);
    row.totalQuantity += quantity;
    row.batchCount++;
    if (batch.expiryStatus === "expired") row.expiredQuantity += quantity;
    else {
      row.availableQuantity += quantity;
      const expires = Date.parse(batch.expiresAt);
      const next = row.nextExpiresAt ? Date.parse(row.nextExpiresAt) : Infinity;
      if (expires < next) {
        row.nextExpiresAt = batch.expiresAt;
        row.nextExpiryQuantity = quantity;
      } else if (expires === next) row.nextExpiryQuantity += quantity;
    }
  }
  return [...groups.values()]
    .map((row) => ({
      ...row,
      totalQuantity: row.totalQuantity / 1000,
      availableQuantity: row.availableQuantity / 1000,
      expiredQuantity: row.expiredQuantity / 1000,
      nextExpiryQuantity: row.nextExpiryQuantity / 1000,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName, "ru"));
}
