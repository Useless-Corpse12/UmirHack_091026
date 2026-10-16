import { z } from "zod";
import { ApiError } from "./errors.ts";
import { MAX_SHELF_LIFE_SECONDS } from "../lib/shelfLife.ts";

const number = z.number().finite().nonnegative();
const date = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Некорректная дата");
export const roleSchema = z.preprocess(
  (v) =>
    typeof v === "number"
      ? ["owner", "admin", "manager", "cashier"][v]
      : typeof v === "string"
        ? v.toLowerCase()
        : v,
  z.enum(["owner", "admin", "manager", "cashier"]),
);
export const membershipSchema = z.object({
  restaurantId: z.string(),
  name: z.string(),
  role: roleSchema,
});
const unitSchema = z
  .string()
  .trim()
  .min(1, "Укажите единицу измерения")
  .max(20)
  .regex(/^[^\r\n\t]+$/);
const productFields = z.object({
  productId: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  shelfLifeSeconds: z
    .number()
    .int()
    .min(1)
    .max(MAX_SHELF_LIFE_SECONDS)
    .optional(),
  shelfLifeDays: z.number().int().min(1).max(3650).optional(),
  unit: unitSchema.optional(),
});
const durationPresent = (p: {
  shelfLifeSeconds?: number;
  shelfLifeDays?: number;
}) => (p.shelfLifeSeconds === undefined) !== (p.shelfLifeDays === undefined);
const durationMessage = {
  message: "Укажите один срок: shelfLifeSeconds или прежний shelfLifeDays",
  path: ["shelfLifeSeconds"],
};
export const productDraftSchema = productFields
  .refine(durationPresent, durationMessage)
  .transform(({ shelfLifeDays, ...p }) => ({
    ...p,
    shelfLifeSeconds: p.shelfLifeSeconds ?? shelfLifeDays! * 86400,
  }));
export const productsDraftSchema = z
  .array(productDraftSchema)
  .min(1)
  .max(1000)
  .superRefine((list, ctx) => {
    const names = new Set<string>();
    list.forEach((p, i) => {
      if (names.has(p.name.toLowerCase()))
        ctx.addIssue({
          code: "custom",
          path: [i, "name"],
          message: "Название повторяется",
        });
      names.add(p.name.toLowerCase());
    });
  });
const productSchema = productFields
  .extend({
    productId: z.string(),
    unit: unitSchema.default("шт."),
    reorderLevel: number.optional(),
  })
  .refine(durationPresent, durationMessage)
  .transform(({ shelfLifeDays, ...p }) => ({
    ...p,
    shelfLifeSeconds: p.shelfLifeSeconds ?? shelfLifeDays! * 86400,
  }));
const ingredientSchema = z.object({
  productId: z.string().min(1, "Выберите продукт"),
  quantity: z
    .number({ invalid_type_error: "Количество должно быть числом" })
    .finite("Количество должно быть конечным числом")
    .min(0.001, "Количество должно быть не меньше 0,001")
    .max(1e9, "Количество должно быть не больше 1 000 000 000")
    .refine(
      (n) => Math.abs(n - Math.round(n * 1000) / 1000) <= 1e-7,
      "Количество: не больше трёх знаков после запятой",
    ),
});
export const dishDraftSchema = z.object({
  dishId: z.string().min(1).optional(),
  name: z
    .string()
    .trim()
    .min(1, "Введите название блюда")
    .max(100, "Название блюда: не больше 100 символов"),
  recipe: z
    .array(ingredientSchema)
    .min(1, "Добавьте хотя бы один ингредиент")
    .max(100, "У блюда не может быть больше 100 ингредиентов")
    .superRefine((recipe, ctx) => {
      const seen = new Set<string>();
      recipe.forEach((item, index) => {
        if (seen.has(item.productId))
          ctx.addIssue({
            code: "custom",
            path: [index, "productId"],
            message: "Ингредиент повторяется",
          });
        seen.add(item.productId);
      });
    }),
});
export const menuDraftSchema = z
  .array(dishDraftSchema)
  .max(1000, "В меню не может быть больше 1000 блюд")
  .superRefine((dishes, ctx) => {
    const names = new Set<string>();
    const ids = new Set<string>();
    dishes.forEach((dish, index) => {
      const name = dish.name.toLowerCase();
      if (names.has(name))
        ctx.addIssue({
          code: "custom",
          path: [index, "name"],
          message: "Название блюда повторяется",
        });
      if (dish.dishId && ids.has(dish.dishId))
        ctx.addIssue({
          code: "custom",
          path: [index, "dishId"],
          message: "ID блюда повторяется",
        });
      names.add(name);
      if (dish.dishId) ids.add(dish.dishId);
    });
  });
const menuDocumentSchema = z.object({
  restaurantId: z.string(),
  version: z.number().int().nonnegative(),
  dishes: z
    .array(dishDraftSchema.extend({ dishId: z.string().min(1) }))
    .refine(
      (dishes) => menuDraftSchema.safeParse(dishes).success,
      "В меню не должны повторяться блюда и ингредиенты",
    ),
});
const shortageSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  required: number,
  available: number,
  expired: number,
});
const supplyItem = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: number,
  factQuantity: number.optional(),
  batchId: z.string().optional(),
  expiresAt: date,
});
export const expiryApprovalSchema = z.object({
  approvalId: z.string(),
  batchId: z.string(),
  supplyId: z.string(),
  supplyNumber: z.string().optional(),
  productId: z.string(),
  productName: z.string(),
  quantity: number,
  expiresAt: date,
  approvedAt: date,
  approvedBy: z.string(),
  approvedByEmail: z.string().optional(),
});
export const snapshotSchema = z.object({
  restaurantId: z.string(),
  revision: z.number().int().nonnegative(),
  generatedAt: date,
  catalog: z.array(productSchema),
  expiryApprovals: z.array(expiryApprovalSchema).default([]),
  batches: z.array(
    z.object({
      batchId: z.string(),
      supplyId: z.string(),
      supplyNumber: z.string().optional(),
      productId: z.string(),
      productName: z.string(),
      quantity: number,
      receivedAt: date,
      expiresAt: date,
      expiryStatus: z.enum(["fresh", "soon", "expired"]),
      remainingHours: z.number().finite(),
    }),
  ),
  supplies: z.array(
    z.object({
      supplyId: z.string(),
      restaurantId: z.string(),
      supplyNumber: z.string(),
      createdAt: date,
      status: z.enum(["pending", "partial", "accepted", "rejected"]),
      decidedAt: date.optional(),
      items: z.array(supplyItem),
    }),
  ),
  menu: z
    .array(
      z.object({
        dishId: z.string(),
        name: z.string(),
        recipe: z.array(z.object({ productId: z.string(), quantity: number })),
        availablePortions: number,
        isAvailable: z.boolean(),
      }),
    )
    .default([]),
  menuVersion: z.number().int().nonnegative().optional(),
  stopList: z.array(
    z.object({
      dishId: z.string(),
      name: z.string(),
      shortages: z.array(shortageSchema),
    }),
  ),
  recommendations: z.array(
    z.object({
      dishId: z.string(),
      name: z.string(),
      availablePortions: number,
      score: number,
      reason: z.string(),
      expiresAt: date,
    }),
  ),
  procurement: z.array(
    z.object({
      productId: z.string(),
      productName: z.string(),
      available: number,
      target: number,
      suggested: number,
    }),
  ),
  recentOrders: z
    .array(
      z.object({
        orderId: z.string(),
        createdAt: date,
        status: z.string(),
        items: z.array(
          z.object({ dishId: z.string(), name: z.string(), quantity: number }),
        ),
        allocations: z
          .array(
            z.object({
              batchId: z.string(),
              supplyId: z.string(),
              productId: z.string(),
              quantity: number,
            }),
          )
          .optional(),
      }),
    )
    .default([]),
  metrics: z.object({
    productTypes: number,
    expiringBatches: number,
    expiredBatches: number,
    stoppedDishes: number,
    pendingSupplies: number,
    completedOrders: number,
  }),
  orderHistory: z
    .array(z.object({ date: z.string(), orders: number }))
    .default([]),
});
const employeeSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: roleSchema,
});
const posSchema = z.object({
  posId: z.string(),
  restaurantId: z.string(),
  name: z.string(),
  status: z.string(),
  createdAt: date,
});
// ASP.NET may return PascalCase. Business field renames require an explicit adapter.
function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k.charAt(0).toLowerCase() + k.slice(1),
        camelize(v),
      ]),
    );
  return value;
}
export function decode<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: unknown,
): T {
  const result = schema.safeParse(camelize(value));
  if (!result.success)
    throw new ApiError(
      0,
      "CONTRACT_MISMATCH",
      "Ответ сервера не соответствует согласованному формату",
      result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    );
  return result.data;
}
export const decodeSnapshot = (v: unknown) => decode(snapshotSchema, v);
export const decodeMenu = (v: unknown) => decode(menuDocumentSchema, v);
export const decodeExpiryReceipt = (v: unknown) =>
  decode(
    z.object({
      restaurantId: z.string(),
      revision: number.int(),
      status: z.literal("approved"),
      approval: expiryApprovalSchema,
    }),
    v,
  );
export const decodeMemberships = (v: unknown) =>
  decode(z.array(membershipSchema), v);
export const decodeMembership = (v: unknown) => decode(membershipSchema, v);
export const decodeProducts = (v: unknown) => decode(z.array(productSchema), v);
export const decodeEmployees = (v: unknown) =>
  decode(z.array(employeeSchema), v);
export const decodePoints = (v: unknown) => decode(z.array(posSchema), v);
