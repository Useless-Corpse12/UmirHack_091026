import { menuDraftSchema } from "../api/schemas.ts";
import type { DishDraft, Product } from "../types/models.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const key = (name: string) => name.trim().toLowerCase();
function productsByName(catalog: Product[]) {
  const products = new Map<string, Product>();
  for (const product of catalog) {
    if (products.has(key(product.name)))
      throw new Error(
        `В каталоге повторяется название «${product.name}». Сначала исправьте каталог`,
      );
    products.set(key(product.name), product);
  }
  return products;
}

// The portable file uses names; API requests keep stable dish/product IDs.
export function parseMenuFile(
  text: string,
  catalog: Product[],
  existing: DishDraft[] = [],
): DishDraft[] {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value))
    throw new Error("Меню должно быть объектом: название блюда → ингредиенты");
  const products = productsByName(catalog);
  const dishes = new Map(existing.map((d) => [key(d.name), d]));
  const draft = Object.entries(value).map(([name, ingredients]) => {
    if (!isRecord(ingredients))
      throw new Error(`«${name}»: нужен объект с ингредиентами и количеством`);
    const previous = dishes.get(key(name));
    return {
      ...(previous?.dishId ? { dishId: previous.dishId } : {}),
      name,
      recipe: Object.entries(ingredients).map(([productName, quantity]) => {
        const product = products.get(key(productName));
        if (!product)
          throw new Error(
            `«${name}»: продукт «${productName}» не найден в каталоге ресторана`,
          );
        return { productId: product.productId, quantity };
      }),
    };
  });
  return menuDraftSchema.parse(draft);
}

export function stringifyMenuFile(
  draft: DishDraft[],
  catalog: Product[],
): string {
  productsByName(catalog);
  const products = new Map(catalog.map((p) => [p.productId, p]));
  const dishes = menuDraftSchema.parse(draft);
  const file = Object.fromEntries(
    dishes.map((dish) => [
      dish.name,
      Object.fromEntries(
        dish.recipe.map((item) => {
          const product = products.get(item.productId);
          if (!product)
            throw new Error(
              `«${dish.name}»: ингредиент отсутствует в каталоге. Выберите другой продукт`,
            );
          return [product.name, item.quantity];
        }),
      ),
    ]),
  );
  return JSON.stringify(file, null, 2) + "\n";
}
