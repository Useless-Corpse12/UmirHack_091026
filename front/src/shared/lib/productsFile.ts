import type { Product, ProductDraft } from "../types/models";

const draftOf = ({ productId, name, shelfLifeSeconds, unit }: Product): ProductDraft => ({
  productId,
  name,
  shelfLifeSeconds,
  unit,
});

/** A round-trippable JSON export of the current restaurant product catalog. */
export function stringifyProductsFile(products: Product[]): string {
  return JSON.stringify(products.map(draftOf), null, 2);
}

/** PUT /products is a full replacement; keep untouched catalog rows intact. */
export function mergeProductCatalog(
  current: Product[],
  draft: ProductDraft,
  editId: string | null,
): ProductDraft[] {
  if (!editId) return [...current.map(draftOf), draft];
  if (!current.some((item) => item.productId === editId)) {
    throw new Error("Продукт удалён или изменён в другом окне. Обновите каталог.");
  }
  return current.map((product) =>
    product.productId === editId ? { ...draft, productId: editId } : draftOf(product),
  );
}
