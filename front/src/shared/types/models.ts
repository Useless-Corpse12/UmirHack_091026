export type DataMode = "mock" | "live";
export type Role = "owner" | "admin" | "manager" | "cashier";
export type InviteRole = "manager" | "admin";
export type ConnectionState =
  "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";
export interface User {
  id: string;
  email: string;
}
export interface Session {
  accessToken: string;
  user: User;
  expiresAt: number;
  dataMode: DataMode;
}
export interface Credentials {
  email: string;
  password: string;
}
export interface Membership {
  restaurantId: string;
  name: string;
  role: Role;
}
export interface ProductDraft {
  productId?: string;
  name: string;
  shelfLifeSeconds: number;
  /** Omitted only by older imports; the server preserves the existing unit. */
  unit?: string;
}
export interface Product extends ProductDraft {
  productId: string;
  unit: string;
  reorderLevel?: number;
}
export interface Batch {
  batchId: string;
  supplyId: string;
  supplyNumber?: string;
  productId: string;
  productName: string;
  quantity: number;
  receivedAt: string;
  expiresAt: string;
  expiryStatus: "fresh" | "soon" | "expired";
  remainingHours: number;
}
export interface ExpiryApproval {
  approvalId: string;
  batchId: string;
  supplyId: string;
  supplyNumber?: string;
  productId: string;
  productName: string;
  quantity: number;
  expiresAt: string;
  approvedAt: string;
  approvedBy: string;
  approvedByEmail?: string;
}
export interface SupplyItem {
  productId: string;
  productName: string;
  quantity: number;
  factQuantity?: number;
  batchId?: string;
  expiresAt: string;
}
export interface Supply {
  supplyId: string;
  restaurantId: string;
  supplyNumber: string;
  createdAt: string;
  status: "pending" | "partial" | "accepted" | "rejected";
  decidedAt?: string;
  items: SupplyItem[];
}
export interface Shortage {
  productId: string;
  productName: string;
  required: number;
  available: number;
  expired: number;
}
export interface StopListItem {
  dishId: string;
  name: string;
  shortages: Shortage[];
}
export interface Recommendation {
  dishId: string;
  name: string;
  availablePortions: number;
  score: number;
  reason: string;
  expiresAt: string;
}
export interface Dish {
  dishId: string;
  name: string;
  recipe: { productId: string; quantity: number }[];
  availablePortions: number;
  isAvailable: boolean;
}
export interface DishDraft {
  dishId?: string;
  name: string;
  recipe: { productId: string; quantity: number }[];
}
export interface MenuDocument {
  restaurantId: string;
  version: number;
  dishes: (DishDraft & { dishId: string })[];
}
export interface Employee {
  userId: string;
  email: string;
  role: Role;
}
export interface PosPoint {
  posId: string;
  restaurantId: string;
  name: string;
  status: string;
  createdAt: string;
}
export interface OrderSummary {
  orderId: string;
  createdAt: string;
  status: string;
  items: { dishId: string; name: string; quantity: number }[];
  allocations?: {
    batchId: string;
    supplyId: string;
    productId: string;
    quantity: number;
  }[];
}
export interface Procurement {
  productId: string;
  productName: string;
  available: number;
  target: number;
  suggested: number;
}
export interface Snapshot {
  restaurantId: string;
  revision: number;
  generatedAt: string;
  batches: Batch[];
  supplies: Supply[];
  expiryApprovals: ExpiryApproval[];
  catalog: Product[];
  menu: Dish[];
  menuVersion?: number;
  stopList: StopListItem[];
  recommendations: Recommendation[];
  procurement: Procurement[];
  recentOrders: OrderSummary[];
  metrics: {
    productTypes: number;
    expiringBatches: number;
    expiredBatches: number;
    stoppedDishes: number;
    pendingSupplies: number;
    completedOrders: number;
  };
  orderHistory: { date: string; orders: number }[];
}
export interface MutationReceipt {
  restaurantId: string;
  revision: number;
  status: string;
  orderId?: string;
  supplyId?: string;
}
