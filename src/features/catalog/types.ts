import type { BadgeTone } from "@/components/ui/badge";
import type { MediaImage } from "@/components/ui/media-frame";

/** Homepage view models: the minimum each section needs, never whole DB rows. */

export type HomeCategory = {
  slug: string;
  title: string;
  image: MediaImage;
};

export type HomeProduct = {
  slug: string;
  title: string;
  categorySlug: string;
  pricePaisa: number;
  image: MediaImage;
};

export type HomeCollection = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  image: MediaImage;
};

export type Testimonial = {
  id: string;
  quote: string;
  authorName: string;
  authorLabel: string;
  avatar: MediaImage;
};

export type HomepageData = {
  categories: HomeCategory[];
  featuredProducts: HomeProduct[];
  collections: HomeCollection[];
  testimonials: Testimonial[];
};

/* ---------- Product details (view models for /products/[slug]) ---------- */

export type CategoryRef = {
  slug: string;
  title: string;
};

export type ProductBadge = {
  tone: BadgeTone;
  label: string;
};

export type ProductRating = {
  /** Average rating, 0–5. */
  value: number;
  count: number;
};

/** Card-sized product used by rails and grids that show a rating. */
export type ProductSummary = HomeProduct & {
  rating: ProductRating | null;
};

export type ProductOptionValue = {
  value: string;
  label: string;
  /** Colour chip for values without a photo of their own. */
  swatchHex?: string;
};

export type ProductOption = {
  /** Display name and key into `ProductVariant.optionValues`, e.g. "Color". */
  name: string;
  values: ProductOptionValue[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  /** Option name -> option value, e.g. `{ Color: "grey" }`. */
  optionValues: Record<string, string>;
  /** Overrides the product's base price when set. */
  pricePaisa: number | null;
  stockQuantity: number;
};

export type ProductMedia = {
  id: string;
  image: MediaImage;
  /** Photos of one specific variant; `null` for photos shared by every variant. */
  variantId: string | null;
};

export type ProductSpec = {
  label: string;
  value: string;
};

export type TryOnMode = "live" | "photo";

export type TryOnPlacement =
  | "ear"
  | "face"
  | "neck"
  | "wrist"
  | "hand"
  | "upper_body"
  | "full_body"
  | "freeform";

export type ProductTryOn = {
  modes: TryOnMode[];
  placement: TryOnPlacement;
  /** Decorative image for the "Try It On in AR" card. */
  previewImage: MediaImage;
};

export type ProductDetail = {
  slug: string;
  title: string;
  category: CategoryRef;
  badge: ProductBadge | null;
  rating: ProductRating | null;
  shortDescription: string;
  description: string;
  basePricePaisa: number;
  lowStockThreshold: number;
  options: ProductOption[];
  variants: ProductVariant[];
  media: ProductMedia[];
  specs: ProductSpec[];
  careInstructions: string;
  /** Present only when a try-on capability is configured for the product. */
  tryOn: ProductTryOn | null;
};
