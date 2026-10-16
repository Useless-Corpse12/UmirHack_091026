import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function checkMenu({
  page,
  browser,
  base,
  restaurantId,
  otherId,
  demo,
  output,
  pageErrors,
  poll,
}) {
  const name = (index) =>
    page.getByLabel(`Название блюда ${index}`, { exact: true });
  const quantity = (dish, ingredient) =>
    page.getByLabel(`Количество ингредиента ${ingredient} блюда ${dish}`, {
      exact: true,
    });
  const save = () =>
    page
      .getByRole("button", { name: "Сохранить всё меню", exact: true })
      .click();
  const importFile = (value) =>
    page.getByLabel("Загрузить меню JSON", { exact: true }).setInputFiles({
      name: "menu.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(value)),
    });
  const download = async () => {
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: "Скачать всё меню JSON", exact: true })
        .click(),
    ]);
    assert.equal(file.suggestedFilename(), "menu.json");
    return JSON.parse(await readFile(await file.path(), "utf8"));
  };
  await page.getByRole("link", { name: "Меню", exact: true }).click();
  await poll(
    async () => (await name(1).inputValue()) === "Овощной салат",
    "initial menu",
  );
  const initial = demo
    .getState()
    .restaurants.find((r) => r.id === restaurantId);
  await name(1).fill("Салат с томатами");
  await quantity(1, 1).fill("0");
  await save();
  await page
    .getByRole("alert")
    .filter({ hasText: "Количество должно быть не меньше" })
    .waitFor();
  assert.equal(
    demo.getState().restaurants.find((r) => r.id === restaurantId).menuVersion,
    initial.menuVersion,
  );
  await quantity(1, 1).fill("0.5");
  await page
    .getByRole("button", { name: "Добавить блюдо", exact: true })
    .click();
  await name(2).fill("Томатная лепёшка");
  await page
    .getByRole("button", { name: "Добавить ингредиент в блюдо 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Удалить ингредиент 2 блюда 2", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Ингредиент 2 блюда 2", { exact: true }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Добавить ингредиент в блюдо 2", exact: true })
    .click();
  const flour = initial.products.find((p) => p.name === "Мука");
  await page
    .getByLabel("Ингредиент 2 блюда 2", { exact: true })
    .selectOption(flour.productId);
  await quantity(2, 2).fill("125.125");
  const expectedFile = {
    "Салат с томатами": { Томаты: 0.5, Огурцы: 1 },
    "Томатная лепёшка": { Томаты: 1, Мука: 125.125 },
  };
  assert.deepEqual(await download(), expectedFile);
  assert.equal(
    demo.getState().restaurants.find((r) => r.id === restaurantId).dishes
      .length,
    1,
  );
  const routePath = "**/api/Restaurant/" + restaurantId + "/menu";
  await page.route(routePath, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        code: "TEST_OFFLINE",
        message: "Меню пока не сохранилось",
      }),
    }),
  );
  await save();
  await page.getByText("Меню пока не сохранилось", { exact: true }).waitFor();
  assert.equal(await name(2).inputValue(), "Томатная лепёшка");
  assert.equal(await quantity(2, 2).inputValue(), "125.125");
  await page.unroute(routePath);
  const requestPromise = page.waitForRequest(
    (request) => request.method() === "PUT" && request.url().endsWith("/menu"),
  );
  await save();
  const request = (await requestPromise).postDataJSON();
  assert.equal(request.version, initial.menuVersion);
  assert.equal(request.dishes.length, 2);
  assert.equal(request.dishes[0].dishId, initial.dishes[0].dishId);
  await page
    .getByText("Меню сохранено целиком. Блюд: 2.", { exact: true })
    .waitFor();
  const saved = demo.getState().restaurants.find((r) => r.id === restaurantId);
  assert.equal(saved.dishes[0].dishId, initial.dishes[0].dishId);
  assert.equal(saved.dishes[1].recipe[1].productId, flour.productId);
  await page.reload();
  await poll(
    async () => (await name(2).inputValue()) === "Томатная лепёшка",
    "saved menu survives reload",
  );
  assert.deepEqual(await download(), expectedFile);
  console.log(
    "PASS: menu editor changes recipes, adds/removes ingredients and dishes, exports all JSON, retains failed drafts and saves a complete menu with stable IDs",
  );

  const adminContext = await browser.newContext();
  try {
    const admin = await adminContext.newPage();
    admin.on("pageerror", (e) => pageErrors.push(e.message));
    await admin.goto(base);
    await admin.getByLabel("Email", { exact: true }).fill("admin@demo.test");
    await admin.getByLabel("Пароль", { exact: true }).fill("Demo123!");
    await admin.getByRole("button", { name: "Войти", exact: true }).click();
    await admin
      .getByRole("heading", { name: "Мои рестораны", exact: true })
      .waitFor();
    await admin.goto(base + "/restaurant/" + restaurantId + "/menu");
    await admin.getByLabel("Название блюда 2", { exact: true }).waitFor();
    await quantity(1, 1).fill("0.75");
    await admin
      .getByLabel("Название блюда 1", { exact: true })
      .fill("Салат для кухни");
    await admin
      .getByLabel("Количество ингредиента 1 блюда 1", { exact: true })
      .fill("0.25");
    await admin
      .getByRole("button", { name: "Сохранить всё меню", exact: true })
      .click();
    await admin
      .getByText("Меню сохранено целиком. Блюд: 2.", { exact: true })
      .waitFor();
    await page
      .getByRole("alert")
      .filter({ hasText: "Меню изменили в другом окне" })
      .waitFor();
    assert.equal(await quantity(1, 1).inputValue(), "0.75");
    assert.equal(
      await page
        .getByRole("button", { name: "Сохранить всё меню", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal((await download())["Салат с томатами"].Томаты, 0.75);
    await page
      .getByRole("button", {
        name: "Заменить черновик меню с сервера",
        exact: true,
      })
      .click();
    await poll(
      async () => (await name(1).inputValue()) === "Салат для кухни",
      "reload shared menu",
    );
    assert.equal(await quantity(1, 1).inputValue(), "0.25");
  } finally {
    await adminContext.close();
  }
  await page.screenshot({
    path: resolve(output, "menu-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(output, "menu-mobile.png"),
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "menu must not overflow on mobile",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await importFile({ "Неверное блюдо": { "Нет такого продукта": 1 } });
  await page
    .getByRole("alert")
    .filter({ hasText: "не найден в каталоге ресторана" })
    .waitFor();
  assert.equal(await name(1).inputValue(), "Салат для кухни");
  await importFile({ Лепёшка: { Мука: 125.125 } });
  await page
    .getByText(
      "Файл проверен. Он заменил черновик целиком; на сервере меню пока не изменилось.",
      { exact: true },
    )
    .waitFor();
  assert.equal(await page.getByTestId("menu-dish").count(), 1);
  assert.equal(
    demo.getState().restaurants.find((r) => r.id === restaurantId).dishes
      .length,
    2,
  );
  await save();
  await page
    .getByText("Меню сохранено целиком. Блюд: 1.", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Удалить блюдо 1", exact: true })
    .click();
  assert.equal(await page.getByTestId("menu-dish").count(), 0);
  assert.deepEqual(await download(), {});
  await save();
  await page
    .getByText("Меню сохранено целиком. Блюд: 0.", { exact: true })
    .waitFor();
  assert.equal(
    demo.getState().restaurants.find((r) => r.id === restaurantId).dishes
      .length,
    0,
  );
  await page.goto(base + "/restaurant/" + otherId + "/menu");
  await poll(
    () => Promise.resolve(page.url().endsWith("/dashboard")),
    "manager cannot edit menu",
  );
  assert.equal(
    await page.getByRole("link", { name: "Меню", exact: true }).count(),
    0,
  );
  console.log(
    "PASS: admin menu edits arrive by WebSocket without overwriting owner drafts; unknown products are rejected, import replaces all dishes, removal/empty menu and mobile layout work; manager is blocked",
  );
}
