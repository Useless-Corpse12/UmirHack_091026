const isGuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export interface ArrivedItem { productId: string; productName: string; arrivedQuantity: number; unit: string; expiresAt?: string }
export interface IncomingSupply { supplyId: string; supplyNumber?: string; arrivedAt?: string; supplier?: string; items: ArrivedItem[] }
export type SupplyMessageMode = "append" | "replace";

const obj = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const pick = (value: Record<string, unknown>, ...names: string[]) => names.map((name) => value[name]).find((item) => item !== undefined && item !== null);
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const quantity = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};
const pending = new Set(["pending", "arrived", "delivered", "received", "awaiting", "waiting", "inprogress", "in_progress", "ожидает", "прибыла", "доставлена"]);
/** Only build cards from records with actual IDs, product IDs and numeric arrived amounts.
 * Analytics history is accepted only when status explicitly identifies a pending delivery.
 * The pre-existing backend does NOT provide this data through a GET endpoint.
 */
export function parseIncomingSupplies(raw: unknown, fromAnalytics = false): IncomingSupply[] {
  const envelope = obj(raw);
  const source = Array.isArray(raw) ? raw
    : Array.isArray(envelope?.supplies) ? envelope.supplies
    : Array.isArray(envelope?.deliveries) ? envelope.deliveries
    : Array.isArray(envelope?.data) ? envelope.data
    : [raw];
  const records = source;
  const result: IncomingSupply[] = [];
  for (const record of records) {
    const supply = obj(record);
    if (!supply) continue;
    const state = str(pick(supply, "status", "state", "supplyStatus")).toLowerCase();
    if ((fromAnalytics || !!state) && !pending.has(state)) continue;
    const supplyId = str(pick(supply, "supplyId", "id", "deliveryId"));
    if (!isGuid(supplyId)) continue;
    const rawItems = pick(supply, "items", "products", "positions", "supplyItems", "supplyProducts");
    if (!Array.isArray(rawItems) || rawItems.length === 0) continue;
    const items: ArrivedItem[] = [];
    for (const rawItem of rawItems) {
      const row = obj(rawItem);
      if (!row) continue;
      const embeddedProduct = obj(row.product);
      const productId = str(pick(row, "productId") ?? (embeddedProduct && pick(embeddedProduct, "productId", "id")));
      const arrivedQuantity = quantity(pick(row, "arrivedQuantity", "deliveredQuantity", "receivedQuantity", "quantity", "expectedQuantity", "plannedQuantity"));
      if (!isGuid(productId) || arrivedQuantity === null) continue;
      const productName = str(pick(row, "productName", "name") ?? (embeddedProduct && pick(embeddedProduct, "name", "productName")));
      const expiresAt = str(pick(row, "expiresAt", "expirationDate"));
      // Existing backend's new handler may emit "Unknown" because SupplyItem.Product is not loaded.
      items.push({
        productId,
        productName: productName && productName.toLowerCase() !== "unknown" ? productName : `Продукт ${productId.slice(0, 8)}`,
        arrivedQuantity,
        unit: str(pick(row, "unit", "measureUnit")),
        ...(expiresAt ? { expiresAt } : {}),
      });
    }
    if (items.length !== rawItems.length || new Set(items.map((item) => item.productId.toLowerCase())).size !== items.length) continue;
    const supplyNumber = str(pick(supply, "supplyNumber", "number"));
    result.push({ supplyId, items,
      ...(supplyNumber ? { supplyNumber } : {}),
      arrivedAt: str(pick(supply, "arrivedAt", "deliveredAt", "createdAt")) || undefined,
      supplier: str(pick(supply, "supplierName", "supplier")) || undefined,
    });
  }
  return Array.from(new Map(result.map((supply) => [supply.supplyId.toLowerCase(), supply])).values());
}

/** manager.supplies from SupplyIncomingHandler is a *delta*: the hub sends just
 * the newly arrived supply in an array, not the complete pending-supplies list.
 * SignalR method names are case-insensitive; our existing legacy names still work.
 */
export function parseSupplySignal(target: string, payload: unknown): { data: IncomingSupply[]; mode: SupplyMessageMode } | null {
  const method = target.toLowerCase();
  if (method === "manager.supplies") {
    return { data: parseIncomingSupplies(payload), mode: "append" };
  }
  if (method === "suppliesupdated" || method === "supplyarrived") {
    return { data: parseIncomingSupplies(payload), mode: method === "supplyarrived" ? "append" : "replace" };
  }
  return null;
}

/** Deduplicate by supplyId, including repeated signals and casing differences.
 * Pending supplies are kept until the API confirms that one was processed.
 */
export function mergeIncomingSupplies(current: IncomingSupply[] | null, updates: IncomingSupply[], mode: SupplyMessageMode): IncomingSupply[] {
  if (mode === "replace") return [...new Map(updates.map((s) => [s.supplyId.toLowerCase(), s])).values()];
  const byId = new Map((current || []).map((s) => [s.supplyId.toLowerCase(), s]));
  for (const supply of updates) byId.set(supply.supplyId.toLowerCase(), supply);
  return [...byId.values()];
}
