import type { HomeProduct } from "./types";

/** Homepage "Handpicked Just for You" filter tabs (client-safe, no data). */
export type FeaturedTab = {
  key: string;
  label: string;
  /** Category slugs shown under this tab; `null` means every product. */
  categorySlugs: readonly string[] | null;
  /** Where the empty state sends shoppers. */
  href: string;
};

export const FEATURED_TABS: readonly FeaturedTab[] = [
  { key: "all", label: "All", categorySlugs: null, href: "/search" },
  { key: "dresses", label: "Dresses", categorySlugs: ["dresses"], href: "/categories/dresses" },
  { key: "jewelry", label: "Jewelry", categorySlugs: ["jewelry"], href: "/categories/jewelry" },
  { key: "bags", label: "Bags", categorySlugs: ["bags"], href: "/categories/bags" },
  {
    key: "accessories",
    label: "Accessories",
    categorySlugs: ["sunglasses", "hats", "scarves"],
    href: "/categories",
  },
];

export function filterByTab(products: HomeProduct[], tab: FeaturedTab): HomeProduct[] {
  const slugs = tab.categorySlugs;
  if (slugs === null) return products;
  return products.filter((product) => slugs.includes(product.categorySlug));
}
