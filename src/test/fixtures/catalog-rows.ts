/**
 * TEST FIXTURES — Supabase row shapes for the catalog mappers and read
 * functions. Small and hand-written; the real data is supabase/seed.ndjson.
 */
import type {
  CardRow,
  CategoryRow,
  CollectionRow,
  DetailRow,
  RatingRow,
  TestimonialRow,
} from "@/features/catalog/mappers";

export const FIXED_NOW = Date.parse("2026-09-24T06:15:00.000Z");

export const categoryRows: CategoryRow[] = [
  { id: "c-jewelry", parent_id: null, slug: "jewelry", title: "Jewelry", description: "Everyday gold and silver.", image_path: "categories/jewelry.jpg" },
  { id: "c-bags", parent_id: null, slug: "bags", title: "Bags", description: "Totes and handbags.", image_path: "categories/bags.jpg" },
  { id: "c-hats", parent_id: null, slug: "hats", title: "Hats", description: "Beanies and fedoras.", image_path: null },
  { id: "c-earrings", parent_id: "c-jewelry", slug: "earrings", title: "Earrings", description: "Studs, hoops and jhumkas.", image_path: "categories/earrings.jpg" },
  { id: "c-jhumkas", parent_id: "c-earrings", slug: "jhumkas", title: "Jhumkas", description: "Bell-shaped drops.", image_path: null },
];

function card(overrides: Partial<CardRow> & Pick<CardRow, "id" | "slug" | "title" | "category_id">): CardRow {
  return {
    base_price_paisa: 249900,
    is_bestseller: false,
    is_limited_edition: false,
    published_at: "2025-10-01T05:00:00.000Z",
    product_media: [{ storage_path: `products/${overrides.slug}/01.jpg`, alt_text: `${overrides.title} photo` }],
    ...overrides,
  };
}

export const cardRows: CardRow[] = [
  card({ id: "p-pearl", slug: "pearl-drop-earrings", title: "Pearl Drop Earrings", category_id: "c-earrings", is_bestseller: true }),
  card({ id: "p-bracelet", slug: "minimal-gold-bracelet", title: "Minimal Gold Bracelet", category_id: "c-jewelry", base_price_paisa: 179900 }),
  card({ id: "p-jhumka", slug: "silver-jhumka", title: "Silver Jhumka", category_id: "c-jhumkas", base_price_paisa: 129900, product_media: [] }),
  card({ id: "p-tote", slug: "canvas-tote", title: "Canvas Tote", category_id: "c-bags", base_price_paisa: 99900 }),
  card({ id: "p-fedora", slug: "felt-fedora", title: "Felt Fedora", category_id: "c-hats" }),
];

export const ratingRows: RatingRow[] = [
  { product_id: "p-pearl", rating_avg: 4.8, rating_count: 120 },
  { product_id: "p-tote", rating_avg: 4, rating_count: 0 },
];

export const detailRow: DetailRow = {
  id: "p-pearl",
  slug: "pearl-drop-earrings",
  title: "Pearl Drop Earrings",
  category_id: "c-earrings",
  base_price_paisa: 249900,
  is_bestseller: true,
  is_limited_edition: false,
  published_at: "2025-10-01T05:00:00.000Z",
  short_description: "Freshwater pearls on gold-plated hooks.",
  description: "Hand-set freshwater pearls.",
  low_stock_threshold: 3,
  options: [
    {
      name: "Metal",
      values: [
        { value: "gold", label: "Gold", swatch_hex: "#C9A24A" },
        { value: "silver", label: "Silver", swatch_hex: null },
      ],
    },
  ],
  specs: [{ label: "Material", value: "Freshwater pearl" }],
  care_instructions: "Wipe with a soft cloth.",
  product_variants: [
    { id: "v-silver", sku: "GRT-PDE-SLV", option_values: { Metal: "silver" }, price_paisa: 229900, stock_quantity: 0, sort_order: 2, is_active: true },
    { id: "v-gold", sku: "GRT-PDE-GLD", option_values: { Metal: "gold" }, price_paisa: null, stock_quantity: 12, sort_order: 1, is_active: true },
    { id: "v-old", sku: "GRT-PDE-OLD", option_values: { Metal: "gold" }, price_paisa: null, stock_quantity: 5, sort_order: 3, is_active: false },
  ],
  product_media: [
    { id: "m-2", storage_path: "products/pearl-drop-earrings/02.jpg", alt_text: "Silver pair", sort_order: 2, variant_id: "v-silver" },
    { id: "m-1", storage_path: "products/pearl-drop-earrings/01.jpg", alt_text: "Pearl earrings on a model", sort_order: 1, variant_id: null },
  ],
  product_ar_assets: [
    { mode: "photo_ai", placement: "upper_body", is_active: true },
    { mode: "live_2d", placement: "ear", is_active: true },
  ],
};

export const collectionRows: CollectionRow[] = [
  { slug: "autumn-styles", eyebrow: "New collection", title: "Autumn Styles", description: "Warm tones.", hero_image_path: "collections/autumn-styles.jpg", hero_image_alt: "Woven wrap" },
  { slug: "no-photo", eyebrow: "Draft", title: "No Photo Yet", description: "", hero_image_path: null, hero_image_alt: "" },
];

export const testimonialRows: TestimonialRow[] = [
  { review_id: "r-1", quote: "Beautiful finish and quick delivery to Pokhara.", author_name: "Priya S.", product_title: "Pearl Drop Earrings", product_slug: "pearl-drop-earrings" },
];
