import {
  seedCategories,
  seedCollections,
  seedFeaturedProducts,
  seedTestimonials,
} from "./dev-seed";
import type { HomepageData } from "./types";

const EMPTY: HomepageData = {
  categories: [],
  featuredProducts: [],
  collections: [],
  testimonials: [],
};

/**
 * Data for the storefront homepage.
 *
 * Until the Supabase catalog exists this serves the development seed, and only
 * outside production — the live store renders empty states rather than fake
 * products or testimonials. Replace the body with Supabase reads; the return
 * shape is the contract the page depends on.
 */
export async function getHomepageData(): Promise<HomepageData> {
  if (process.env.NODE_ENV === "production") return EMPTY;

  return {
    categories: seedCategories,
    featuredProducts: seedFeaturedProducts,
    collections: seedCollections,
    testimonials: seedTestimonials,
  };
}
