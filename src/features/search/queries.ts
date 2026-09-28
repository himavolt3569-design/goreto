import "server-only";
import { unstable_cache } from "next/cache";
import type { SelectOption } from "@/components/ui/select";
import { CATALOG_CACHE_TAG } from "@/features/catalog/categories";
import { categoryOptions } from "@/features/catalog/category-options";
import { indexCategories, toProductSummary } from "@/features/catalog/mappers";
import { fetchActiveCategories, fetchRatings } from "@/features/catalog/queries";
import type { ProductSummary } from "@/features/catalog/types";
import { getPublicSupabase } from "@/lib/supabase/public";
import { toCardRow } from "./mappers";
import { rupeesToPaisa, SEARCH_PAGE_SIZE, type SearchParams } from "./params";

/*
 * `/search` reads: one `search_products` RPC (anon client, so no Clerk and
 * RLS limits it to the active catalog) plus the page's rating summaries.
 * Cached per normalised parameter set like the category listing, and dropped
 * with the rest of the catalog when an admin edit revalidates the tag.
 */

const SEARCH_REVALIDATE_SECONDS = 60;

export type SearchResults = {
  products: ProductSummary[];
  total: number;
  pageCount: number;
};

export type SearchCategoryOption = SelectOption;

const loadSearchResults = unstable_cache(
  async (params: SearchParams): Promise<SearchResults> => {
    const { data, error } = await getPublicSupabase().rpc("search_products", {
      q: params.q || undefined,
      category_slug: params.category ?? undefined,
      min_price_paisa: rupeesToPaisa(params.minRupees) ?? undefined,
      max_price_paisa: rupeesToPaisa(params.maxRupees) ?? undefined,
      sort: params.sort,
      page_limit: SEARCH_PAGE_SIZE,
      page_offset: (params.page - 1) * SEARCH_PAGE_SIZE,
    });
    if (error) throw new Error(`Catalog query failed (search): ${error.message}`);

    const [index, ratings] = await Promise.all([
      fetchActiveCategories().then(indexCategories),
      fetchRatings(data.map((row) => row.id)),
    ]);
    // An empty page past the end has no row to carry the total; the page shows "no results".
    const total = Number(data[0]?.total_count ?? 0);
    return {
      products: data.map((row) => toProductSummary(toCardRow(row), index, ratings)),
      total,
      pageCount: Math.ceil(total / SEARCH_PAGE_SIZE),
    };
  },
  ["catalog:search"],
  { revalidate: SEARCH_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
);

export function searchProducts(params: SearchParams): Promise<SearchResults> {
  return loadSearchResults(params);
}

/** "All categories" plus the category tree, valued by slug, for the filter Select. */
export async function getSearchCategoryOptions(): Promise<{
  options: SearchCategoryOption[];
  titleBySlug: Record<string, string>;
}> {
  const rows = await fetchActiveCategories();
  const byId = new Map(rows.map((row) => [row.id, row]));
  const tree = categoryOptions(
    rows.map((row) => ({
      id: row.slug,
      title: row.title,
      parentId: row.parent_id ? (byId.get(row.parent_id)?.slug ?? null) : null,
    })),
  );
  return {
    options: [{ value: "", label: "All categories" }, ...tree],
    titleBySlug: Object.fromEntries(rows.map((row) => [row.slug, row.title])),
  };
}
