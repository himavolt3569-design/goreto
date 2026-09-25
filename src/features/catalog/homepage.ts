import {
  indexCategories,
  toHomeCategory,
  toHomeCollection,
  toHomeProduct,
  toTestimonial,
} from "./mappers";
import {
  fetchActiveCategories,
  fetchLiveCollections,
  fetchProductCards,
  fetchTestimonials,
} from "./queries";
import type { HomepageData } from "./types";

/** The rail shows this many top-level categories, then "More". */
export const CATEGORY_RAIL_LIMIT = 10;
const TESTIMONIAL_COUNT = 3;

/**
 * Data for the storefront homepage, from Supabase. Sections render their
 * empty states when the store has no data yet.
 */
export async function getHomepageData(): Promise<HomepageData> {
  const [categoryRows, featuredRows, collectionRows, testimonialRows] = await Promise.all([
    fetchActiveCategories(),
    fetchProductCards({ featuredOnly: true }),
    fetchLiveCollections(),
    fetchTestimonials(TESTIMONIAL_COUNT),
  ]);
  const index = indexCategories(categoryRows);

  return {
    categories: index.topLevel.slice(0, CATEGORY_RAIL_LIMIT).map(toHomeCategory),
    featuredProducts: featuredRows.map((row) => toHomeProduct(row, index)),
    collections: collectionRows.flatMap((row) => toHomeCollection(row) ?? []),
    testimonials: testimonialRows.map(toTestimonial),
  };
}
