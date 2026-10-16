import { randomUUID } from "node:crypto";

export class DomainError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const fail = (status, code, message, details) => {
  throw new DomainError(status, code, message, details);
};
export const amount = (n) => Math.round(n * 1000) / 1000;
export function positive(value, field = "Количество") {
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n <= 0 ||
    n > 1e9 ||
    Math.abs(n - amount(n)) > 1e-7
  ) {
    fail(
      400,
      "VALIDATION",
      field + " должно быть положительным числом с точностью до 0,001",
    );
  }
  return n;
}
export function restaurantOf(state, id) {
  const r = state.restaurants.find((v) => v.id === id);
  if (!r) fail(404, "NOT_FOUND", "Ресторан не найден");
  return r;
}
export function membershipOf(
  state,
  userId,
  restaurantId,
  allowed = ["owner", "admin", "manager"],
) {
  const m = state.memberships.find(
    (v) => v.userId === userId && v.restaurantId === restaurantId,
  );
  if (!m || !allowed.includes(m.role))
    fail(403, "FORBIDDEN", "Недостаточно прав в этом ресторане");
  return m;
}
export const domainNow = (state, now) => now + state.clockOffsetMs;
export const productOf = (r, id) => r.products.find((p) => p.productId === id);
export function productShelfLifeSeconds(product) {
  const hasSeconds = product.shelfLifeSeconds !== undefined;
  const hasDays = product.shelfLifeDays !== undefined;
  if (hasSeconds === hasDays)
    fail(
      400,
      "VALIDATION",
      "Укажите один срок: shelfLifeSeconds или shelfLifeDays",
    );
  const value = hasSeconds ? product.shelfLifeSeconds : product.shelfLifeDays;
  const max = hasSeconds ? 3650 * 86400 : 3650;
  if (!Number.isInteger(value) || value < 1 || value > max)
    fail(400, "VALIDATION", "Срок хранения — от 1 секунды до 3650 дней");
  return hasSeconds ? value : value * 86400;
}
export function productUnit(value = "шт.") {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 20 ||
    /[\r\n\t]/.test(value)
  )
    fail(400, "VALIDATION", "Единица измерения: от 1 до 20 символов");
  return value.trim();
}
export function available(r, productId, now) {
  return amount(
    r.batches
      .filter((b) => b.productId === productId && Date.parse(b.expiresAt) > now)
      .reduce((sum, b) => sum + b.quantity, 0),
  );
}
export function recipeNeeds(r, items) {
  if (!Array.isArray(items) || !items.length)
    fail(400, "VALIDATION", "Заказ не может быть пустым");
  const needs = new Map();
  const normalized = items.map((item) => {
    const dish = r.dishes.find((d) => d.dishId === item.dishId);
    if (!dish) fail(404, "NOT_FOUND", "Блюдо не найдено");
    const quantity = positive(item.quantity);
    if (!Number.isInteger(quantity) || quantity > 10000)
      fail(400, "VALIDATION", "Количество блюд должно быть целым");
    for (const ingredient of dish.recipe) {
      needs.set(
        ingredient.productId,
        amount(
          (needs.get(ingredient.productId) || 0) +
            ingredient.quantity * quantity,
        ),
      );
    }
    return { dishId: dish.dishId, name: dish.name, quantity };
  });
  return { needs, items: normalized };
}
export function shortagesFor(r, needs, now) {
  return [...needs]
    .filter(([id, required]) => available(r, id, now) < required)
    .map(([id, required]) => {
      const p = productOf(r, id);
      return {
        productId: id,
        productName: p?.name || id,
        required,
        available: available(r, id, now),
        expired: amount(
          r.batches
            .filter((b) => b.productId === id && Date.parse(b.expiresAt) <= now)
            .reduce((sum, b) => sum + b.quantity, 0),
        ),
      };
    });
}
export function makeOrder(r, body, now) {
  const { needs, items } = recipeNeeds(r, body.items);
  const shortages = shortagesFor(r, needs, now);
  if (shortages.length)
    fail(
      409,
      "INSUFFICIENT_STOCK",
      "Не хватает пригодных ингредиентов. Заказ не создан.",
      { shortages },
    );
  const allocations = [];
  for (const [productId, required] of needs) {
    let left = required;
    const batches = r.batches
      .filter(
        (b) =>
          b.productId === productId &&
          b.quantity > 0 &&
          Date.parse(b.expiresAt) > now,
      )
      .sort(
        (a, b) =>
          Date.parse(a.expiresAt) - Date.parse(b.expiresAt) ||
          a.batchId.localeCompare(b.batchId),
      );
    for (const b of batches) {
      if (left <= 0) break;
      const take = Math.min(b.quantity, left);
      b.quantity = amount(b.quantity - take);
      left = amount(left - take);
      allocations.push({
        batchId: b.batchId,
        supplyId: b.supplyId,
        productId,
        quantity: take,
      });
    }
  }
  const order = {
    orderId: randomUUID(),
    createdAt: new Date(now).toISOString(),
    items,
    allocations,
    status: "completed",
  };
  r.orders.push(order);
  r.revision += 1;
  return {
    orderId: order.orderId,
    restaurantId: r.id,
    revision: r.revision,
    status: "completed",
  };
}
export function createSupply(r, body, now) {
  if (!Array.isArray(body.items) || !body.items.length)
    fail(400, "VALIDATION", "Поставка не может быть пустой");
  const items = body.items.map((item) => {
    const p = productOf(r, item.productId);
    if (!p) fail(404, "NOT_FOUND", "Продукт не найден в каталоге ресторана");
    const expiresAt =
      item.expiresAt ||
      new Date(now + productShelfLifeSeconds(p) * 1000).toISOString();
    if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now)
      fail(400, "VALIDATION", "Нужен будущий срок годности партии");
    return {
      productId: p.productId,
      productName: p.name,
      quantity: positive(item.quantity),
      expiresAt,
    };
  });
  const supply = {
    supplyId: randomUUID(),
    restaurantId: r.id,
    supplyNumber: String(body.supplyNumber || "SUP-" + Date.now())
      .trim()
      .slice(0, 100),
    createdAt: new Date(now).toISOString(),
    status: "pending",
    items,
  };
  r.supplies.push(supply);
  r.revision += 1;
  return {
    supplyId: supply.supplyId,
    restaurantId: r.id,
    revision: r.revision,
    status: "pending",
  };
}
export function decideSupply(r, id, decision, now) {
  const s = r.supplies.find((v) => v.supplyId === id);
  if (!s) fail(404, "NOT_FOUND", "Поставка не найдена");
  if (s.status === decision)
    return { restaurantId: r.id, revision: r.revision, status: decision };
  if (s.status !== "pending")
    fail(409, "ALREADY_DECIDED", "Поставка уже обработана");
  if (decision === "accepted") {
    if (s.items.some((i) => Date.parse(i.expiresAt) <= now))
      fail(409, "EXPIRED_SUPPLY", "В поставке уже есть просроченные партии");
    for (const item of s.items) {
      r.batches.push({
        batchId: randomUUID(),
        supplyId: s.supplyId,
        receivedAt: new Date(now).toISOString(),
        ...item,
      });
    }
  }
  s.status = decision;
  s.decidedAt = new Date(now).toISOString();
  r.revision += 1;
  return { restaurantId: r.id, revision: r.revision, status: decision };
}
export function approveExpiry(r, batchId, now, user) {
  r.expiryApprovals ||= [];
  const previous = r.expiryApprovals.find((a) => a.batchId === batchId);
  if (previous)
    return {
      restaurantId: r.id,
      revision: r.revision,
      status: "approved",
      approval: previous,
    };
  const batch = r.batches.find((b) => b.batchId === batchId);
  if (!batch) fail(404, "NOT_FOUND", "Партия не найдена в этом ресторане");
  if (Date.parse(batch.expiresAt) > now)
    fail(409, "NOT_EXPIRED", "Срок годности этой партии ещё не истёк");
  if (batch.quantity <= 0) fail(409, "EMPTY_BATCH", "В партии уже нет остатка");
  const product = productOf(r, batch.productId);
  const approval = {
    approvalId: randomUUID(),
    batchId,
    supplyId: batch.supplyId,
    supplyNumber:
      r.supplies.find((s) => s.supplyId === batch.supplyId)?.supplyNumber ||
      batch.supplyNumber,
    productId: batch.productId,
    productName: product?.name || batch.productName,
    quantity: batch.quantity,
    expiresAt: batch.expiresAt,
    approvedAt: new Date(now).toISOString(),
    approvedBy: user.id,
    approvedByEmail: user.email,
  };
  // This batch was already unusable. Approval records the manager's write-off.
  batch.quantity = 0;
  r.expiryApprovals.push(approval);
  r.revision += 1;
  return {
    restaurantId: r.id,
    revision: r.revision,
    status: "approved",
    approval,
  };
}
export function saveProducts(r, draft) {
  if (!Array.isArray(draft) || !draft.length || draft.length > 1000)
    fail(400, "VALIDATION", "Нужен список от 1 до 1000 продуктов");
  const seen = new Set();
  for (const item of draft) {
    if (!item || typeof item !== "object" || typeof item.name !== "string")
      fail(400, "VALIDATION", "Нужны поля продукта");
    const name = String(item.name || "").trim();
    if (!name || name.length > 100)
      fail(400, "VALIDATION", "Название продукта: от 1 до 100 символов");
    if (seen.has(name.toLowerCase()))
      fail(400, "VALIDATION", "Повторяющееся название: " + name);
    seen.add(name.toLowerCase());
    const shelfLifeSeconds = productShelfLifeSeconds(item);
    const existing = item.productId
      ? productOf(r, item.productId)
      : r.products.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (item.productId && !existing)
      fail(404, "NOT_FOUND", "Редактируемый продукт не найден");
    const product = {
      productId: existing?.productId || randomUUID(),
      name,
      shelfLifeSeconds,
      unit: productUnit(item.unit === undefined ? existing?.unit : item.unit),
      reorderLevel: existing?.reorderLevel || 0,
    };
    if (existing) {
      delete existing.shelfLifeDays;
      Object.assign(existing, product);
    } else r.products.push(product);
  }
  const names = new Set();
  for (const product of r.products) {
    const key = product.name.trim().toLowerCase();
    if (names.has(key))
      fail(
        409,
        "PRODUCT_NAME_EXISTS",
        "Продукт с таким названием уже есть в каталоге",
      );
    names.add(key);
  }
  r.revision += 1;
  return r.products;
}
export function menuDocument(r) {
  return { restaurantId: r.id, version: r.menuVersion, dishes: r.dishes };
}

export function saveMenu(r, body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !Number.isInteger(body.version) ||
    body.version < 0 ||
    !Array.isArray(body.dishes) ||
    body.dishes.length > 1000
  )
    fail(
      400,
      "VALIDATION",
      "Нужны version и список dishes, не больше 1000 блюд",
    );
  if (body.version !== r.menuVersion)
    fail(
      409,
      "MENU_CHANGED",
      "Меню уже изменили. Загрузите актуальное меню с сервера; ваш черновик пока сохранён в редакторе",
    );
  const names = new Set();
  const ids = new Set();
  const dishes = body.dishes.map((dish) => {
    if (!dish || typeof dish !== "object" || typeof dish.name !== "string")
      fail(400, "VALIDATION", "У блюда должно быть название");
    const name = dish.name.trim();
    if (!name || name.length > 100 || names.has(name.toLowerCase()))
      fail(
        400,
        "VALIDATION",
        "Названия блюд должны быть уникальны, от 1 до 100 символов",
      );
    names.add(name.toLowerCase());
    const existing =
      dish.dishId === undefined
        ? r.dishes.find((d) => d.name.toLowerCase() === name.toLowerCase())
        : r.dishes.find((d) => d.dishId === dish.dishId);
    if (dish.dishId !== undefined && !existing)
      fail(404, "NOT_FOUND", "Редактируемое блюдо не найдено в ресторане");
    const dishId = existing?.dishId || randomUUID();
    if (ids.has(dishId)) fail(400, "VALIDATION", "ID блюда повторяется");
    ids.add(dishId);
    if (
      !Array.isArray(dish.recipe) ||
      !dish.recipe.length ||
      dish.recipe.length > 100
    )
      fail(
        400,
        "VALIDATION",
        `«${name}»: нужен список от 1 до 100 ингредиентов`,
      );
    const ingredients = new Set();
    const recipe = dish.recipe.map((item) => {
      if (!item || typeof item !== "object" || !productOf(r, item.productId))
        fail(
          400,
          "VALIDATION",
          `«${name}»: ингредиент не найден в каталоге ресторана`,
        );
      if (ingredients.has(item.productId))
        fail(400, "VALIDATION", `«${name}»: ингредиент повторяется`);
      ingredients.add(item.productId);
      if (typeof item.quantity !== "number")
        fail(400, "VALIDATION", `«${name}»: количество должно быть числом`);
      return { productId: item.productId, quantity: positive(item.quantity) };
    });
    return { ...existing, dishId, name, recipe };
  });
  r.dishes = dishes;
  r.menuVersion += 1;
  r.revision += 1;
  return menuDocument(r);
}

export function snapshot(r, state, now) {
  now = domainNow(state, now);
  const batches = r.batches
    .filter((b) => b.quantity > 0)
    .map((b) => {
      const p = productOf(r, b.productId);
      const remainingHours = (Date.parse(b.expiresAt) - now) / 3600000;
      return {
        ...b,
        supplyNumber:
          r.supplies.find((s) => s.supplyId === b.supplyId)?.supplyNumber ||
          b.supplyNumber,
        productName: p?.name || b.productName,
        expiryStatus:
          remainingHours <= 0
            ? "expired"
            : remainingHours <= 72
              ? "soon"
              : "fresh",
        remainingHours,
      };
    });
  const stopList = [];
  const recommendations = [];
  const menu = r.dishes.map((d) => {
    const needs = new Map(d.recipe.map((i) => [i.productId, i.quantity]));
    const shortages = shortagesFor(r, needs, now);
    const availablePortions = Math.max(
      0,
      Math.min(
        ...d.recipe.map((i) =>
          Math.floor(available(r, i.productId, now) / i.quantity),
        ),
      ),
    );
    if (shortages.length)
      stopList.push({ dishId: d.dishId, name: d.name, shortages });
    if (!shortages.length) {
      const expiring = d.recipe.flatMap((i) =>
        batches
          .filter(
            (b) => b.productId === i.productId && b.expiryStatus === "soon",
          )
          .map((b) => ({
            ...b,
            score: b.quantity / i.quantity / Math.max(b.remainingHours, 1),
          })),
      );
      if (expiring.length) {
        const soonest = expiring.sort(
          (a, b) => a.remainingHours - b.remainingHours,
        )[0];
        recommendations.push({
          dishId: d.dishId,
          name: d.name,
          availablePortions,
          score: amount(expiring.reduce((sum, b) => sum + b.score, 0)),
          reason:
            soonest.productName +
            ": партия истекает через " +
            Math.max(1, Math.ceil(soonest.remainingHours)) +
            " ч.",
          expiresAt: soonest.expiresAt,
        });
      }
    }
    return { ...d, availablePortions, isAvailable: !shortages.length };
  });
  const procurement = r.products
    .filter((p) => available(r, p.productId, now) < p.reorderLevel)
    .map((p) => ({
      productId: p.productId,
      productName: p.name,
      available: available(r, p.productId, now),
      target: p.reorderLevel,
      suggested: amount(p.reorderLevel - available(r, p.productId, now)),
    }));
  const history = new Map();
  for (const order of r.orders) {
    const date = order.createdAt.slice(0, 10);
    history.set(date, (history.get(date) || 0) + 1);
  }
  return {
    restaurantId: r.id,
    revision: r.revision,
    generatedAt: new Date(now).toISOString(),
    batches,
    catalog: r.products,
    supplies: r.supplies,
    expiryApprovals: (r.expiryApprovals || []).toReversed(),
    menu,
    menuVersion: r.menuVersion,
    stopList,
    recommendations: recommendations.sort((a, b) => b.score - a.score),
    procurement,
    recentOrders: r.orders.slice(-20).reverse(),
    metrics: {
      productTypes: new Set(batches.map((b) => b.productId)).size,
      expiringBatches: batches.filter((b) => b.expiryStatus === "soon").length,
      expiredBatches: batches.filter((b) => b.expiryStatus === "expired")
        .length,
      stoppedDishes: stopList.length,
      pendingSupplies: r.supplies.filter((s) => s.status === "pending").length,
      completedOrders: r.orders.length,
    },
    orderHistory: [...history]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, orders]) => ({ date, orders })),
  };
}
export function seedState(hash, now = Date.now()) {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const adminId = "22222222-2222-4222-8222-222222222222";
  const managerId = "33333333-3333-4333-8333-333333333333";
  const r1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const r2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const tomato = "10000000-0000-4000-8000-000000000001";
  const cucumber = "10000000-0000-4000-8000-000000000002";
  const date = (hours) => new Date(now + hours * 3600000).toISOString();
  const products = [
    {
      productId: tomato,
      name: "Томаты",
      shelfLifeSeconds: 5 * 86400,
      unit: "шт.",
      reorderLevel: 6,
    },
    {
      productId: cucumber,
      name: "Огурцы",
      shelfLifeSeconds: 7 * 86400,
      unit: "шт.",
      reorderLevel: 4,
    },
  ];
  const restaurant = {
    id: r1,
    name: "Демо-ресторан",
    apiSecretHash: hash("demo-supplier-key"),
    products,
    revision: 1,
    supplies: [],
    orders: [],
    writeOffs: [],
    expiryApprovals: [],
    dishes: [
      {
        dishId: "20000000-0000-4000-8000-000000000001",
        name: "Овощной салат",
        recipe: [
          { productId: tomato, quantity: 2 },
          { productId: cucumber, quantity: 1 },
        ],
      },
    ],
    batches: [
      {
        batchId: randomUUID(),
        supplyId: randomUUID(),
        productId: tomato,
        productName: "Томаты",
        quantity: 1,
        receivedAt: date(-24),
        expiresAt: date(20),
      },
      {
        batchId: randomUUID(),
        supplyId: randomUUID(),
        productId: tomato,
        productName: "Томаты",
        quantity: 2,
        receivedAt: date(-24),
        expiresAt: date(120),
      },
      {
        batchId: randomUUID(),
        supplyId: randomUUID(),
        productId: cucumber,
        productName: "Огурцы",
        quantity: 2,
        receivedAt: date(-24),
        expiresAt: date(120),
      },
      {
        batchId: randomUUID(),
        supplyId: randomUUID(),
        productId: tomato,
        productName: "Томаты",
        quantity: 3,
        receivedAt: date(-120),
        expiresAt: date(-12),
      },
    ],
  };
  restaurant.supplies.push(
    ...restaurant.batches.map((b, i) => ({
      supplyId: b.supplyId,
      restaurantId: r1,
      supplyNumber: "DEMO-" + String(i + 1).padStart(3, "0"),
      createdAt: b.receivedAt,
      decidedAt: b.receivedAt,
      status: "accepted",
      items: [
        {
          productId: b.productId,
          productName: b.productName,
          quantity: b.quantity,
          expiresAt: b.expiresAt,
        },
      ],
    })),
  );
  createSupply(
    restaurant,
    {
      supplyNumber: "DEMO-PENDING-001",
      items: [{ productId: tomato, quantity: 4 }],
    },
    now,
  );
  return {
    schemaVersion: 1,
    jwtSecret: randomUUID() + randomUUID(),
    clockOffsetMs: 0,
    sessions: [],
    invitations: [],
    idempotency: {},
    users: [
      {
        id: ownerId,
        email: "owner@demo.test",
        passwordHash: hash("Demo123!"),
        isVerified: true,
      },
      {
        id: adminId,
        email: "admin@demo.test",
        passwordHash: hash("Demo123!"),
        isVerified: true,
      },
      {
        id: managerId,
        email: "manager@demo.test",
        passwordHash: hash("Demo123!"),
        isVerified: true,
      },
    ],
    memberships: [
      { userId: ownerId, restaurantId: r1, role: "owner" },
      { userId: ownerId, restaurantId: r2, role: "manager" },
      { userId: adminId, restaurantId: r1, role: "admin" },
      { userId: managerId, restaurantId: r1, role: "manager" },
    ],
    restaurants: [
      restaurant,
      {
        id: r2,
        name: "Учебное кафе",
        apiSecretHash: hash(randomUUID()),
        products: [],
        batches: [],
        supplies: [],
        orders: [],
        dishes: [],
        writeOffs: [],
        revision: 1,
      },
    ],
    posPoints: [],
  };
}
