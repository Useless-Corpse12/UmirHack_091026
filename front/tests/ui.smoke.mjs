// Optional: npm install --no-save playwright; npx playwright install chromium; npm run test:ui
// Uses a private, in-memory demo service. Does not modify .demo-data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { createDemoServer } from "../demo/server.mjs";
import { checkMenu } from "./menu.ui.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const RID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const base = "http://127.0.0.1:5189";
let offset = 0;
const demo = createDemoServer({
  now: () => Date.now() + offset,
  accessTtlSeconds: 60,
  origins: [base],
});
demo.server.listen(0, "127.0.0.1");
await once(demo.server, "listening");
const demoPort = demo.server.address().port;
let browser;
const children = [];
const extraDemos = [];
const pageErrors = [];
async function poll(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Timeout: " + label);
}
async function startVite(port, mode, serverPort = demoPort) {
  const env = {
    ...process.env,
    DEMO_PORT: String(serverPort),
    VITE_DATA_MODE: mode,
  };
  if (mode === "live") {
    env.VITE_API_URL = "http://127.0.0.1:59998";
  }
  const child = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  children.push(child);
  let logs = "";
  child.stdout.on("data", (s) => {
    logs += s;
  });
  child.stderr.on("data", (s) => {
    logs += s;
  });
  child.on("error", (e) => {
    logs += e.message;
  });
  await poll(async () => {
    if (child.exitCode !== null) throw new Error("Vite stopped: " + logs);
    try {
      return (await fetch("http://127.0.0.1:" + port)).ok;
    } catch {
      return false;
    }
  }, "Vite startup");
}
const output = resolve(process.env.UI_OUTPUT_DIR || ".qa-output");
try {
  await startVite(5189, "mock");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
    args: ["--no-sandbox", "--no-proxy-server"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(() => {
    window.__sockets = [];
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(...args) {
        super(...args);
        window.__sockets.push(this);
      }
    };
  });
  let refreshRequests = 0;
  context.on("request", (r) => {
    if (r.url().includes("/api/Authority/Refresh")) refreshRequests++;
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const login = async (email, password = "Demo123!") => {
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
  };
  await page.goto(base);
  await login("owner@demo.test", "wrongpw");
  await page.getByText("Неверный email или пароль", { exact: true }).waitFor();
  assert.ok(page.url().endsWith("/login"));
  await login("owner@demo.test");
  await page
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  await page.goto(base + "/restaurant/" + RID + "/dashboard");
  await page.getByTestId("connection").filter({ hasText: "Онлайн" }).waitFor();
  await page.getByText("1. Овощной салат", { exact: true }).waitFor();
  assert.equal(
    (await context.cookies()).length,
    0,
    "Login must not issue refresh cookies",
  );
  offset += 61000;
  const failures = await page.evaluate(async (id) => {
    const { restaurantsApi, inventoryApi, managementApi } =
      await import("/src/shared/api/services.ts");
    return (
      await Promise.allSettled([
        restaurantsApi.list(),
        inventoryApi.snapshot(id),
        managementApi.employees(id),
      ])
    ).map((r) => (r.status === "rejected" ? r.reason.status : 200));
  }, RID);
  assert.deepEqual(failures, [401, 401, 401]);
  await poll(
    () => Promise.resolve(page.url().endsWith("/login")),
    "access-only expiry sends user to login",
  );
  assert.equal(refreshRequests, 0);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("access_token")),
    null,
  );
  await login("owner@demo.test");
  await page
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  await page.goto(base + "/restaurant/" + RID + "/dashboard");
  await page.getByTestId("connection").filter({ hasText: "Онлайн" }).waitFor();
  await page.getByTestId("expiry-alerts").waitFor();
  assert.equal(await page.getByTestId("expiry-badge").innerText(), "1");
  assert.equal(await page.getByTestId("supplies-badge").innerText(), "1");
  console.log(
    "PASS: access-only login, reload and concurrent 401s without a refresh or retry",
  );
  await page.getByRole("link", { name: /^Склад/ }).click();
  await page.getByRole("button", { name: "По продуктам", exact: true }).click();
  const tomatoSummary = page
    .getByTestId("warehouse-product-row")
    .filter({ hasText: "Томаты" });
  await tomatoSummary.waitFor();
  assert.equal(
    await tomatoSummary.getByTestId("product-total").innerText(),
    "6 шт.",
  );
  assert.equal(
    await tomatoSummary.getByTestId("product-available").innerText(),
    "3 шт.",
  );
  assert.equal(
    await tomatoSummary.getByTestId("product-expired").innerText(),
    "3 шт.",
  );
  assert.equal(
    await tomatoSummary.getByTestId("product-expiring").innerText(),
    "1 шт.",
  );
  const nearestSeedDate = demo
    .getState()
    .restaurants.find((r) => r.id === RID)
    .batches.filter(
      (b) =>
        b.productId.endsWith("001") && Date.parse(b.expiresAt) > Date.now(),
    )
    .sort(
      (a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt),
    )[0].expiresAt;
  assert.equal(
    await tomatoSummary
      .getByTestId("product-next-expiry")
      .locator("time")
      .getAttribute("datetime"),
    nearestSeedDate,
  );
  await page.getByLabel("Поиск по складу", { exact: true }).fill("огур");
  assert.equal(await page.getByTestId("warehouse-product-row").count(), 1);
  await page.getByLabel("Поиск по складу", { exact: true }).fill("");
  assert.equal(await page.getByLabel("Статус срока годности").count(), 0);
  await page.getByRole("button", { name: "По партиям", exact: true }).click();
  await page.getByLabel("Статус срока годности").selectOption("expired");
  await page.getByRole("cell", { name: /^Просрочена/ }).waitFor();
  await page.getByRole("button", { name: "По продуктам", exact: true }).click();
  assert.equal(
    await tomatoSummary.getByTestId("product-total").innerText(),
    "6 шт.",
  );
  await page.getByRole("link", { name: "Дашборд", exact: true }).click();
  console.log(
    "PASS: product warehouse totals, usable versus expired stock, nearest expiry, search and independent batch filters",
  );
  await page
    .getByText("Демо-инструменты: внешний поставщик и POS", { exact: true })
    .click();
  await page.getByLabel("Порций заказа").fill("2");
  await page
    .getByRole("button", { name: "Подтвердить заказ POS", exact: true })
    .click();
  await page
    .getByText("Не хватает пригодных ингредиентов. Заказ не создан.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    demo.getState().restaurants.find((r) => r.id === RID).orders.length,
    0,
  );
  await page.getByLabel("Порций заказа").fill("1");
  await page
    .getByRole("button", { name: "Подтвердить заказ POS", exact: true })
    .click();
  await page
    .getByText(
      "Сейчас нет доступных блюд с партиями, которые скоро истекают.",
      { exact: true },
    )
    .waitFor();
  const stock = demo.getState().restaurants.find((r) => r.id === RID);
  assert.equal(stock.orders.length, 1);
  assert.equal(
    stock.batches
      .filter(
        (b) =>
          b.productId.endsWith("001") && Date.parse(b.expiresAt) > Date.now(),
      )
      .reduce((s, b) => s + b.quantity, 0),
    1,
  );
  await page.getByRole("link", { name: /^Склад/ }).click();
  await page.getByRole("cell", { name: /^Просрочена/ }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.reload();
  await page.getByTestId("expiry-alerts").waitFor();
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  managerPage.on("pageerror", (e) => pageErrors.push(e.message));
  await managerPage.goto(base);
  await managerPage
    .getByLabel("Email", { exact: true })
    .fill("manager@demo.test");
  await managerPage.getByLabel("Пароль", { exact: true }).fill("Demo123!");
  await managerPage.getByRole("button", { name: "Войти", exact: true }).click();
  await managerPage
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  await managerPage.goto(base + "/restaurant/" + RID + "/dashboard");
  await managerPage.getByTestId("expiry-alerts").waitFor();
  const approvalURL = "**/api/Restaurant/" + RID + "/expiry/*/approve";
  let approvalRequests = 0;
  const countApproval = (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/expiry/") &&
      request.url().endsWith("/approve")
    )
      approvalRequests++;
  };
  page.on("request", countApproval);
  await page.route(approvalURL, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        code: "TEMPORARY",
        message: "Сервер временно недоступен",
      }),
    }),
  );
  await page.getByRole("button", { name: /^Одобрить просрочку/ }).click();
  await page
    .getByTestId("expiry-alerts")
    .getByText("Сервер временно недоступен", { exact: true })
    .waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    demo.getState().restaurants.find((r) => r.id === RID).expiryApprovals
      .length,
    0,
  );
  await page.unroute(approvalURL);
  await page.getByRole("button", { name: /^Одобрить просрочку/ }).click();
  await page.getByTestId("expiry-alerts").waitFor({ state: "detached" });
  await managerPage.getByTestId("expiry-alerts").waitFor({ state: "detached" });
  await page.getByTestId("expiry-history-row").waitFor();
  assert.equal(
    await page
      .getByTestId("expiry-history-row")
      .getByRole("cell", { name: "3", exact: true })
      .count(),
    1,
  );
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(approvalRequests, 2);
  page.off("request", countApproval);
  assert.equal(await page.getByTestId("expiry-badge").count(), 0);
  await page.reload();
  await page.getByTestId("expiry-history-row").waitFor();
  assert.equal(await page.getByTestId("expiry-alerts").count(), 0);
  const approvedStock = demo.getState().restaurants.find((r) => r.id === RID);
  assert.equal(approvedStock.expiryApprovals.length, 1);
  assert.equal(approvedStock.expiryApprovals[0].supplyNumber, "DEMO-004");
  assert.equal(
    approvedStock.batches
      .filter(
        (b) =>
          b.productId.endsWith("001") && Date.parse(b.expiresAt) > Date.now(),
      )
      .reduce((n, b) => n + b.quantity, 0),
    1,
  );
  await managerContext.close();
  console.log(
    "PASS: persistent expiry notice, one-click approval without a dialog, network failure, shared approval and audit history; usable stock unchanged",
  );
  await page.getByRole("link", { name: /^Поставки/ }).click();
  await page.getByRole("button", { name: "Принять", exact: true }).click();
  await page
    .getByText("Нет поставок по выбранным условиям.", { exact: true })
    .waitFor();
  await poll(
    async () => (await page.getByTestId("supplies-badge").count()) === 0,
    "accepted supply clears badge",
  );
  const supplierToken = await page.evaluate(() =>
    localStorage.getItem("access_token"),
  );
  const supplierResult = await fetch(
    "http://127.0.0.1:" + demoPort + "/api/Demo/" + RID + "/supply",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + supplierToken,
      },
      body: JSON.stringify({
        supplyNumber: "OUTSIDE-SUPPLIER",
        items: [
          { productId: "10000000-0000-4000-8000-000000000001", quantity: 1 },
        ],
      }),
    },
  );
  assert.equal(supplierResult.status, 200);
  await page.getByTestId("supplies-badge").filter({ hasText: "1" }).waitFor();
  await page
    .getByTestId("supply-card")
    .filter({ hasText: "OUTSIDE-SUPPLIER" })
    .waitFor();
  assert.equal(
    await page
      .getByTestId("supply-card")
      .filter({ hasText: "OUTSIDE-SUPPLIER" })
      .getAttribute("data-status"),
    "pending",
  );
  await page.getByRole("button", { name: "Отклонить", exact: true }).click();
  await poll(
    async () => (await page.getByTestId("supplies-badge").count()) === 0,
    "rejected supply clears badge",
  );
  console.log(
    "PASS: incoming supplier updates highlighted card and pending badge; accept/reject clears them",
  );
  await page.getByRole("link", { name: "Дашборд", exact: true }).click();
  await page.getByText("Все блюда доступны.", { exact: true }).waitFor();
  console.log(
    "PASS: full-order rollback, FEFO, expired lots, supply acceptance and live dashboard",
  );
  await page.getByRole("link", { name: "Продукты", exact: true }).click();
  await page
    .getByRole("heading", { name: "Каталог продуктов", exact: true })
    .waitFor();
  await page
    .getByRole("columnheader", { name: "Единица", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Импорт JSON", exact: true }).click();
  await page.getByLabel("Загрузить каталог JSON").setInputFiles({
    name: "products.json",
    mimeType: "application/json",
    buffer: Buffer.from('[{"name":"Мука","shelfLifeDays":90,"unit":"g"}]'),
  });
  await poll(
    async () =>
      (
        await page.getByLabel("JSON продуктов", { exact: true }).inputValue()
      ).includes("Мука"),
    "catalog file parsed",
  );
  const catalogRequest = page.waitForRequest(
    (request) =>
      request.method() === "PUT" && request.url().endsWith("/products"),
  );
  await page
    .getByRole("button", { name: "Импортировать продукты", exact: true })
    .click();
  const catalogPayload = (await catalogRequest).postDataJSON();
  assert.deepEqual(catalogPayload, [
    { name: "Мука", shelfLifeSeconds: 90 * 86400, unit: "g" },
  ]);
  await page.getByRole("cell", { name: "Мука", exact: true }).waitFor();
  await page.getByRole("button", { name: "Импорт JSON", exact: true }).click();
  const catalogDraft = '[{"name":"Рис","shelfLifeDays":30}]';
  await page.getByLabel("JSON продуктов", { exact: true }).fill(catalogDraft);
  await page.getByLabel("Загрузить каталог JSON").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.equal(
    await page.getByLabel("JSON продуктов", { exact: true }).inputValue(),
    catalogDraft,
  );
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Добавить продукт", exact: true })
    .click();
  await page.getByLabel("Название продукта", { exact: true }).fill("Рис");
  await page.getByLabel("Дни", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Сохранить продукт", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Срок хранения — от 1 секунды до 3650 дней", { exact: true })
    .waitFor();
  await page.getByLabel("Дни", { exact: true }).fill("30");
  await page.getByLabel("Часы", { exact: true }).fill("2");
  await page.getByLabel("Минуты", { exact: true }).fill("3");
  await page.getByLabel("Секунды", { exact: true }).fill("4");
  await page.getByLabel("Единица измерения", { exact: true }).fill("кг");
  await page
    .getByRole("button", { name: "Сохранить продукт", exact: true })
    .click();
  await page.getByRole("cell", { name: "Рис", exact: true }).waitFor();
  const rice = demo
    .getState()
    .restaurants.find((r) => r.id === RID)
    .products.find((p) => p.name === "Рис");
  assert.equal(rice.shelfLifeSeconds, 30 * 86400 + 2 * 3600 + 3 * 60 + 4);
  assert.equal(rice.unit, "кг");
  await page
    .getByRole("button", { name: "Редактировать продукт Рис", exact: true })
    .click();
  for (const [label, value] of [
    ["Дни", "30"],
    ["Часы", "2"],
    ["Минуты", "3"],
    ["Секунды", "4"],
  ])
    assert.equal(
      await page.getByLabel(label, { exact: true }).inputValue(),
      value,
    );
  assert.equal(
    await page.getByLabel("Единица измерения", { exact: true }).inputValue(),
    "кг",
  );
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  // Another employee changes the catalog while this page stays open.
  const catalogToken = await page.evaluate(() =>
    localStorage.getItem("access_token"),
  );
  const externalProduct = await fetch(
    "http://127.0.0.1:" + demoPort + "/api/Restaurant/" + RID + "/products",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + catalogToken,
      },
      body: JSON.stringify([
        {
          productId: rice.productId,
          name: "Рис длинный",
          shelfLifeSeconds: rice.shelfLifeSeconds,
          unit: "кг",
        },
      ]),
    },
  );
  assert.equal(externalProduct.status, 200);
  await page.getByRole("cell", { name: "Рис длинный", exact: true }).waitFor();
  console.log(
    "PASS: external product edits reach an open catalog through the restaurant WebSocket",
  );
  const flourId = demo
    .getState()
    .restaurants.find((r) => r.id === RID)
    .products.find((p) => p.name === "Мука").productId;
  await page
    .getByRole("button", { name: "Редактировать продукт Мука", exact: true })
    .click();
  await page.getByLabel("Название продукта", { exact: true }).fill("Томаты");
  await page
    .getByRole("button", { name: "Сохранить продукт", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Продукт с таким названием уже есть в каталоге", { exact: true })
    .waitFor();
  assert.equal(
    demo
      .getState()
      .restaurants.find((r) => r.id === RID)
      .products.find((p) => p.productId === flourId).name,
    "Мука",
  );
  await page.getByLabel("Название продукта", { exact: true }).fill("Мука");
  await page.getByLabel("Дни", { exact: true }).fill("91");
  await page.getByLabel("Часы", { exact: true }).fill("1");
  await page.getByLabel("Минуты", { exact: true }).fill("2");
  await page.getByLabel("Секунды", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Сохранить продукт", exact: true })
    .click();
  await page.getByText("Продукт обновлён", { exact: true }).waitFor();
  assert.equal(
    demo
      .getState()
      .restaurants.find((r) => r.id === RID)
      .products.find((p) => p.productId === flourId).shelfLifeSeconds,
    91 * 86400 + 3600 + 120 + 3,
  );
  await page.getByRole("link", { name: "POS-точки", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Добавить кассу", exact: true })
    .click();
  await page.getByLabel("PIN кассы (4–8 цифр)").fill("0123");
  await page
    .getByRole("button", { name: "Создать POS-точку", exact: true })
    .click();
  await page.getByRole("cell", { name: "Касса 1", exact: true }).waitFor();
  assert.equal(await page.getByLabel("PIN кассы (4–8 цифр)").count(), 0);
  await page
    .getByRole("button", { name: "+ Добавить кассу", exact: true })
    .click();
  assert.equal(await page.getByLabel("PIN кассы (4–8 цифр)").inputValue(), "");
  await page.getByLabel("PIN кассы (4–8 цифр)").fill("01234567");
  await page
    .getByRole("button", { name: "Создать POS-точку", exact: true })
    .click();
  await page.getByRole("cell", { name: "Касса 2", exact: true }).waitFor();
  console.log(
    "PASS: catalog dialogs preserve IDs, units, legacy imports, mixed duration parts and failed drafts; POS table updates for leading-zero and 8-digit PINs",
  );
  await page.goto(base + "/restaurant/" + OTHER + "/products");
  await poll(
    () => Promise.resolve(page.url().endsWith("/dashboard")),
    "manager route guard",
  );
  await page.getByTestId("connection").filter({ hasText: "Онлайн" }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Продукты", exact: true }).count(),
    0,
  );
  assert.equal(await page.getByText("Томаты", { exact: true }).count(), 0);
  await page.goto(base + "/restaurant/" + RID + "/dashboard");
  await page.getByTestId("connection").filter({ hasText: "Онлайн" }).waitFor();
  await page.evaluate(() => {
    for (const s of window.__sockets)
      if (s.url.includes("/demo-realtime") && s.readyState === 1) s.close();
  });
  const token = await page.evaluate(() => localStorage.getItem("access_token"));
  const result = await fetch(
    "http://127.0.0.1:" + demoPort + "/api/Demo/" + RID + "/order",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        "Idempotency-Key": "outside-pos",
      },
      body: JSON.stringify({
        items: [
          { dishId: "20000000-0000-4000-8000-000000000001", quantity: 1 },
        ],
      }),
    },
  );
  assert.equal(result.status, 200);
  await page.getByTestId("connection").filter({ hasText: "Онлайн" }).waitFor();
  await poll(
    async () =>
      (await page.locator("main").innerText()).includes("Овощной салат × 1"),
    "reconnection snapshot",
  );
  const open = await page.evaluate(
    () =>
      window.__sockets.filter(
        (s) => s.url.includes("/demo-realtime") && s.readyState === 1,
      ).length,
  );
  assert.equal(open, 1);
  console.log(
    "PASS: restaurant isolation, role guard, WebSocket reconnection and external POS update",
  );
  await page.getByRole("link", { name: "Сотрудники", exact: true }).click();
  const adminCheckbox = page.getByRole("checkbox", {
    name: "Пригласить администратором",
    exact: true,
  });
  assert.equal(await adminCheckbox.isChecked(), false);
  await page.getByLabel("Email сотрудника").fill("qa-admin@demo.test");
  await adminCheckbox.check();
  await page
    .getByRole("button", { name: "Отправить приглашение", exact: true })
    .click();
  await page
    .getByText("Приглашение создано для qa-admin@demo.test.", { exact: false })
    .waitFor();
  const adminCode = demo
    .getState()
    .invitations.find((i) => i.email === "qa-admin@demo.test").code;
  assert.equal(
    demo.getState().invitations.find((i) => i.code === adminCode).role,
    "admin",
  );
  await mkdir(output, { recursive: true });
  await page.screenshot({
    path: resolve(output, "owner-admin-invitation.png"),
    fullPage: true,
  });
  await adminCheckbox.uncheck();
  await page.getByLabel("Email сотрудника").fill("qa@demo.test");
  await page
    .getByRole("button", { name: "Отправить приглашение", exact: true })
    .click();
  await page
    .getByText("Приглашение создано для qa@demo.test.", { exact: false })
    .waitFor();
  const inviteCode = demo
    .getState()
    .invitations.find((i) => i.email === "qa@demo.test").code;
  const inviteURL = base + "/invite/" + encodeURIComponent(inviteCode);
  assert.equal(
    await page.getByLabel("Код приглашения", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Скопировать ссылку", exact: true })
      .count(),
    0,
  );
  assert.equal(
    (await page.locator("main").innerText()).includes(inviteCode),
    false,
  );
  console.log(
    "PASS: invitation is submitted by email with a success message; no invite code or link is displayed to the sender",
  );
  const secondTab = await context.newPage();
  await secondTab.goto(base);
  await secondTab
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await poll(
    () => Promise.resolve(secondTab.url().endsWith("/login")),
    "cross-tab logout",
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("access_token")),
    null,
  );
  await secondTab.close();
  await page.goto(inviteURL);
  await page
    .getByRole("link", { name: "Зарегистрироваться", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("qa@demo.test");
  await page.getByLabel("Пароль", { exact: true }).fill("Demo123!");
  await page.getByLabel("Подтвердите пароль", { exact: true }).fill("Demo123!");
  await page
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  const code = (await page.getByTestId("demo-code").innerText()).match(
    /\d{6}/,
  )[0];
  await page.reload();
  await page.getByTestId("demo-code").waitFor();
  await page.goto(base + "/login");
  await login("qa@demo.test");
  await page
    .getByRole("heading", { name: "Подтверждение почты", exact: true })
    .waitFor();
  await page.getByTestId("demo-code").waitFor();
  await page.getByLabel("Код подтверждения").fill("000000");
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await page.getByText("Код неверен или истёк", { exact: true }).waitFor();
  await page.getByLabel("Код подтверждения").fill(code);
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await login("qa@demo.test");
  await page
    .getByRole("button", { name: "Принять приглашение", exact: true })
    .click();
  await page.getByTestId("connection").filter({ hasText: "Онлайн" }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Сотрудники", exact: true }).count(),
    0,
  );
  console.log(
    "PASS: invitation survives registration/verification/login, email-bound manager role and logout across tabs",
  );
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  adminPage.on("pageerror", (e) => pageErrors.push(e.message));
  await adminPage.goto(base + "/invite/" + encodeURIComponent(adminCode));
  await adminPage
    .getByRole("link", { name: "Зарегистрироваться", exact: true })
    .click();
  await adminPage
    .getByLabel("Email", { exact: true })
    .fill("qa-admin@demo.test");
  await adminPage.getByLabel("Пароль", { exact: true }).fill("Demo123!");
  await adminPage
    .getByLabel("Подтвердите пароль", { exact: true })
    .fill("Demo123!");
  await adminPage
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  const adminVerificationCode = (
    await adminPage.getByTestId("demo-code").innerText()
  ).match(/\d{6}/)[0];
  await adminPage.getByLabel("Код подтверждения").fill(adminVerificationCode);
  await adminPage
    .getByRole("button", { name: "Подтвердить", exact: true })
    .click();
  await adminPage
    .getByLabel("Email", { exact: true })
    .fill("qa-admin@demo.test");
  await adminPage.getByLabel("Пароль", { exact: true }).fill("Demo123!");
  await adminPage.getByRole("button", { name: "Войти", exact: true }).click();
  await adminPage
    .getByRole("button", { name: "Принять приглашение", exact: true })
    .click();
  await adminPage
    .getByRole("link", { name: "Сотрудники", exact: true })
    .click();
  await adminPage.getByLabel("Email сотрудника").waitFor();
  assert.equal(
    await adminPage
      .getByRole("checkbox", {
        name: "Пригласить администратором",
        exact: true,
      })
      .count(),
    0,
  );
  assert.equal(
    await adminPage
      .getByRole("link", { name: "Настройки", exact: true })
      .count(),
    0,
  );
  await adminPage
    .getByLabel("Email сотрудника")
    .fill("qa-manager-from-admin@demo.test");
  await adminPage
    .getByRole("button", { name: "Отправить приглашение", exact: true })
    .click();
  await adminPage
    .getByText("Приглашение создано для qa-manager-from-admin@demo.test.", {
      exact: false,
    })
    .waitFor();
  assert.equal(
    demo
      .getState()
      .invitations.find((i) => i.email === "qa-manager-from-admin@demo.test")
      .role,
    "manager",
  );
  await adminContext.close();
  console.log(
    "PASS: owner checkbox creates an admin invitation; accepted admin can invite managers and has no admin-grant checkbox",
  );
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await login("owner@demo.test");
  await page
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Создать ресторан", exact: true })
    .click();
  await page
    .getByLabel("Название ресторана", { exact: true })
    .fill("Удаляемый ресторан");
  await page
    .getByRole("button", { name: "Сохранить ресторан", exact: true })
    .click();
  await page
    .getByText("Ключ поставщика (показывается один раз):", { exact: false })
    .waitFor();
  const created = demo
    .getState()
    .restaurants.find((r) => r.name === "Удаляемый ресторан");
  await page.goto(base + "/restaurant/" + created.id + "/settings");
  await page
    .getByRole("button", { name: "Удалить ресторан", exact: true })
    .click();
  await page.getByLabel("Название ресторана").fill("Удаляемый ресторан");
  await page
    .getByRole("button", { name: "Удалить ресторан навсегда", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  assert.equal(
    demo.getState().restaurants.some((r) => r.id === created.id),
    false,
  );
  console.log(
    "PASS: restaurant creation, one-time supplier key and owner deletion",
  );
  await page.goto(base + "/restaurant/" + RID + "/dashboard");
  await page.getByTestId("connection").filter({ hasText: "Онлайн" }).waitFor();
  await page.locator(".recharts-wrapper").waitFor();
  await mkdir(output, { recursive: true });
  await page.screenshot({
    path: resolve(output, "dashboard.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: /^Склад/ }).click();
  await page.screenshot({
    path: resolve(output, "warehouse.png"),
    fullPage: true,
  });
  const currentToken = await page.evaluate(() =>
    localStorage.getItem("access_token"),
  );
  const moved = await fetch(
    "http://127.0.0.1:" + demoPort + "/api/Demo/" + RID + "/advance-time",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + currentToken,
      },
      body: JSON.stringify({ hours: 144 }),
    },
  );
  assert.equal(moved.status, 200);
  await page.getByTestId("expiry-alerts").waitFor();
  await page.getByTestId("expiry-badge").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(output, "expiry-mobile.png"),
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "mobile page must not overflow horizontally",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: resolve(output, "expiry-desktop.png"),
    fullPage: true,
  });
  console.log(
    "PASS: newly expired stock reopens the queue after previous approval, desktop and mobile layouts",
  );
  await checkMenu({
    page,
    browser,
    base,
    restaurantId: RID,
    otherId: OTHER,
    demo,
    output,
    pageErrors,
    poll,
  });
  const expiryBase = "http://127.0.0.1:5191";
  const expiryDemo = createDemoServer({
    accessTtlSeconds: 3,
    origins: [expiryBase],
  });
  extraDemos.push(expiryDemo);
  expiryDemo.server.listen(0, "127.0.0.1");
  await once(expiryDemo.server, "listening");
  await startVite(5191, "mock", expiryDemo.server.address().port);
  const shortSession = await browser.newPage();
  shortSession.on("pageerror", (e) => pageErrors.push(e.message));
  let expiryRefreshes = 0;
  shortSession.on("request", (r) => {
    if (r.url().includes("/api/Authority/Refresh")) expiryRefreshes++;
  });
  await shortSession.goto(expiryBase);
  await shortSession
    .getByLabel("Email", { exact: true })
    .fill("owner@demo.test");
  await shortSession.getByLabel("Пароль", { exact: true }).fill("Demo123!");
  await shortSession
    .getByRole("button", { name: "Войти", exact: true })
    .click();
  await shortSession
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  await poll(
    () => Promise.resolve(shortSession.url().endsWith("/login")),
    "idle access token expiry",
    6000,
  );
  assert.equal(
    await shortSession.evaluate(() => localStorage.getItem("access_token")),
    null,
  );
  assert.equal(expiryRefreshes, 0);
  console.log(
    "PASS: idle JWT expiry ends the session without any refresh request",
  );
  const longBase = "http://127.0.0.1:5192";
  const longDemo = createDemoServer({
    accessTtlSeconds: 30 * 24 * 60 * 60,
    origins: [longBase],
  });
  extraDemos.push(longDemo);
  longDemo.server.listen(0, "127.0.0.1");
  await once(longDemo.server, "listening");
  await startVite(5192, "mock", longDemo.server.address().port);
  const longSession = await browser.newPage();
  longSession.on("pageerror", (e) => pageErrors.push(e.message));
  await longSession.goto(longBase);
  await longSession
    .getByLabel("Email", { exact: true })
    .fill("owner@demo.test");
  await longSession.getByLabel("Пароль", { exact: true }).fill("Demo123!");
  await longSession.getByRole("button", { name: "Войти", exact: true }).click();
  await longSession
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  await longSession.reload();
  await longSession
    .getByRole("heading", { name: "Мои рестораны", exact: true })
    .waitFor();
  await longSession.goto(longBase + "/restaurant/" + RID + "/employees");
  await longSession
    .getByRole("checkbox", { name: "Пригласить администратором", exact: true })
    .waitFor();
  assert.ok(
    await longSession.evaluate(() => localStorage.getItem("access_token")),
  );
  console.log(
    "PASS: backend-style 30-day JWT remains authenticated after login, reload and protected navigation",
  );
  await startVite(5190, "live");
  const live = await browser.newPage();
  live.on("pageerror", (e) => pageErrors.push(e.message));
  await live.goto("http://127.0.0.1:5190");
  await live.getByLabel("Email", { exact: true }).fill("owner@demo.test");
  await live.getByLabel("Пароль", { exact: true }).fill("Demo123!");
  await live.getByRole("button", { name: "Войти", exact: true }).click();
  await live
    .getByText("Не удалось связаться с сервером", { exact: true })
    .waitFor();
  assert.ok(live.url().endsWith("/login"));
  assert.equal(
    await live.getByText("Демонстрационный режим.", { exact: false }).count(),
    0,
  );
  assert.deepEqual(pageErrors, []);
  console.log(
    "PASS: live mode reports server failure and never uses demo data; no uncaught page errors",
  );
  console.log("UI smoke completed. Screenshots: " + output);
} finally {
  if (browser) await browser.close();
  for (const child of children) child.kill("SIGTERM");
  await demo.close();
  for (const app of extraDemos) await app.close();
}
