import type { HomeProduct } from "./types";

/** Category page sort options (client-safe, no data). Kept in `?sort=`. */
export const CATEGORY_SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

export type CategorySort = (typeof CATEGORY_SORTS)[number]["value"];

export const DEFAULT_CATEGORY_SORT: CategorySort = "featured";

/** Whitelists a raw `?sort=` value; anything unknown means the default order. */
export function parseCategorySort(value: string | string[] | undefined): CategorySort {
  const raw = Array.isArray(value) ? value[0] : value;
  return CATEGORY_SORTS.find((option) => option.value === raw)?.value ?? DEFAULT_CATEGORY_SORT;
}

/** Returns a new array; "featured" keeps catalog order. Ties keep catalog order. */
export function sortProducts<T extends Pick<HomeProduct, "pricePaisa">>(
  products: readonly T[],
  sort: CategorySort,
): T[] {
  switch (sort) {
    case "featured":
      return [...products];
    case "price-asc":
      return [...products].sort((a, b) => a.pricePaisa - b.pricePaisa);
    case "price-desc":
      return [...products].sort((a, b) => b.pricePaisa - a.pricePaisa);
    default: {
      const unhandled: never = sort;
      throw new Error(`Unhandled sort: ${String(unhandled)}`);
    }
  }
}
