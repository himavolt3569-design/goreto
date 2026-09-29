import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CATALOG_CACHE_TAG } from "./categories";
import { sortProducts, type CategorySort } from "./category-sort";
import { indexCategories, toCollectionDetail, toCollectionSummary, toProductSummary } from "./mappers";
import {
  fetchActiveCategories,
  fetchCollectionBySlug,
  fetchCollectionProductCards,
  fetchCollectionProductCounts,
  fetchLiveCollections,
  fetchRatings,
} from "./queries";
import { isValidSlug } from "./slug";
import type { CollectionDetail, CollectionSummary, ProductSummary } from "./types";

/*
 * Collection reads from Supabase. RLS shows only active collections inside
 * their schedule window, so a scheduled edit can start or end up to one
 * cache interval late, like the rest of the catalog.
 */

const COLLECTION_REVALIDATE_SECONDS = 60;

type CollectionListing = { collection: CollectionDetail; products: ProductSummary[] };

/** Every live collection for `/collections`, with active-product counts. */
export const getCollections = unstable_cache(
  async (): Promise<CollectionSummary[]> => {
    const rows = await fetchLiveCollections();
    const counts = await fetchCollectionProductCounts(rows.map((row) => row.id));
    return rows.map((row) => toCollectionSummary(row, counts));
  },
  ["catalog:collections"],
  { revalidate: COLLECTION_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
);

/**
 * The page reads `searchParams`, so it renders per request; the listing is
 * cached here by slug instead (see `loadCategoryListing`). Products keep the
 * curated order; sorting happens after the cache.
 */
const loadCollectionListing = unstable_cache(
  async (slug: string): Promise<CollectionListing | null> => {
    const row = await fetchCollectionBySlug(slug);
    if (!row) return null;

    const [cards, categories] = await Promise.all([
      fetchCollectionProductCards(row.id),
      fetchActiveCategories(),
    ]);
    const index = indexCategories(categories);
    const ratings = await fetchRatings(cards.map((card) => card.id));
    return {
      collection: toCollectionDetail(row),
      products: cards.map((card) => toProductSummary(card, index, ratings)),
    };
  },
  ["catalog:collection-listing"],
  { revalidate: COLLECTION_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
);

/** Deduplicated per request, so `generateMetadata` and the page share one read. */
export const getCollectionBySlug = cache(async (slug: string): Promise<CollectionDetail | null> => {
  if (!isValidSlug(slug)) return null;
  return (await loadCollectionListing(slug))?.collection ?? null;
});

export async function getCollectionProducts(
  slug: string,
  sort: CategorySort,
): Promise<ProductSummary[]> {
  if (!isValidSlug(slug)) return [];
  const listing = await loadCollectionListing(slug);
  return listing ? sortProducts(listing.products, sort) : [];
}
