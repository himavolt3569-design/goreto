import { z } from "zod";
import { productMediaImage } from "@/lib/media/storage";
import type { Database, Json } from "@/types/database";
import type {
  CategoryDetail,
  CategorySummary,
  HomeCategory,
  HomeCollection,
  HomeProduct,
  ProductBadge,
  ProductDetail,
  ProductOption,
  ProductRating,
  ProductSpec,
  ProductSummary,
  ProductTryOn,
  Testimonial,
} from "./types";

/*
 * Pure row -> view-model mapping for the storefront. Rows come from
 * `queries.ts`; nothing here touches the network, so it is unit-tested with
 * plain fixtures. Client components only ever receive the view models.
 */

type Tables = Database["public"]["Tables"];
type Functions = Database["public"]["Functions"];

export type CategoryRow = Pick<
  Tables["categories"]["Row"],
  "id" | "parent_id" | "slug" | "title" | "description" | "image_path"
>;

export type CardRow = Pick<
  Tables["products"]["Row"],
  | "id"
  | "slug"
  | "title"
  | "category_id"
  | "base_price_paisa"
  | "is_bestseller"
  | "is_limited_edition"
  | "published_at"
> & {
  product_media: Pick<Tables["product_media"]["Row"], "storage_path" | "alt_text">[];
};

export type DetailRow = Omit<CardRow, "product_media"> &
  Pick<
    Tables["products"]["Row"],
    | "short_description"
    | "description"
    | "low_stock_threshold"
    | "options"
    | "specs"
    | "care_instructions"
  > & {
    product_variants: Pick<
      Tables["product_variants"]["Row"],
      "id" | "sku" | "option_values" | "price_paisa" | "stock_quantity" | "sort_order" | "is_active"
    >[];
    product_media: Pick<
      Tables["product_media"]["Row"],
      "id" | "storage_path" | "alt_text" | "sort_order" | "variant_id"
    >[];
    product_ar_assets: Pick<Tables["product_ar_assets"]["Row"], "mode" | "placement" | "is_active">[];
  };

export type CollectionRow = Pick<
  Tables["collections"]["Row"],
  "slug" | "eyebrow" | "title" | "description" | "hero_image_path" | "hero_image_alt"
>;

export type RatingRow = Functions["product_rating_summaries"]["Returns"][number];
export type TestimonialRow = Functions["storefront_testimonials"]["Returns"][number];

/** Products published within this window get the "New" badge. */
export const NEW_BADGE_DAYS = 30;

/* ---------- Categories ---------- */

export type CategoryIndex = {
  byId: ReadonlyMap<string, CategoryRow>;
  bySlug: ReadonlyMap<string, CategoryRow>;
  /** Top-level categories in the order given (sort_order from the query). */
  topLevel: readonly CategoryRow[];
  /** The top-level ancestor of a category (itself when top-level). */
  rootOf(categoryId: string): CategoryRow | undefined;
  /** The category and every category below it. */
  subtreeIds(categoryId: string): string[];
};

export function indexCategories(rows: readonly CategoryRow[]): CategoryIndex {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (row.parent_id) children.set(row.parent_id, [...(children.get(row.parent_id) ?? []), row.id]);
  }

  const rootOf = (categoryId: string): CategoryRow | undefined => {
    let current = byId.get(categoryId);
    // Bounded walk: a malformed cycle can't loop forever.
    for (let depth = 0; current?.parent_id && depth < rows.length; depth += 1) {
      const parent = byId.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    return current;
  };

  const subtreeIds = (categoryId: string): string[] => {
    const seen = new Set<string>();
    const stack = [categoryId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id) || !byId.has(id)) continue;
      seen.add(id);
      stack.push(...(children.get(id) ?? []));
    }
    return [...seen];
  };

  return {
    byId,
    bySlug,
    topLevel: rows.filter((row) => row.parent_id === null),
    rootOf,
    subtreeIds,
  };
}

export function toHomeCategory(row: CategoryRow): HomeCategory {
  return { slug: row.slug, title: row.title, image: productMediaImage(row.image_path, "") };
}

export function toCategorySummary(
  row: CategoryRow,
  index: CategoryIndex,
  productCountByCategory: ReadonlyMap<string, number>,
): CategorySummary {
  const productCount = index
    .subtreeIds(row.id)
    .reduce((total, id) => total + (productCountByCategory.get(id) ?? 0), 0);
  return { ...toHomeCategory(row), productCount };
}

export function toCategoryDetail(row: CategoryRow, index: CategoryIndex): CategoryDetail {
  const parent = row.parent_id ? index.byId.get(row.parent_id) : undefined;
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    parent: parent ? { slug: parent.slug, title: parent.title } : null,
  };
}

/* ---------- Products ---------- */

export function productBadge(
  row: Pick<CardRow, "is_limited_edition" | "is_bestseller" | "published_at">,
  now: number,
): ProductBadge | null {
  if (row.is_limited_edition) return { tone: "limited", label: "Limited" };
  if (row.is_bestseller) return { tone: "bestseller", label: "Bestseller" };
  if (row.published_at) {
    const age = now - Date.parse(row.published_at);
    if (age >= 0 && age <= NEW_BADGE_DAYS * 24 * 60 * 60 * 1000) return { tone: "new", label: "New" };
  }
  return null;
}

export function toRating(row: RatingRow | undefined): ProductRating | null {
  if (!row || row.rating_count <= 0) return null;
  return { value: Number(row.rating_avg), count: row.rating_count };
}

export function toHomeProduct(row: CardRow, index: CategoryIndex): HomeProduct {
  const cover = row.product_media[0];
  return {
    slug: row.slug,
    title: row.title,
    categorySlug: index.rootOf(row.category_id)?.slug ?? "",
    pricePaisa: row.base_price_paisa,
    image: cover ? productMediaImage(cover.storage_path, cover.alt_text) : null,
  };
}

export function toProductSummary(
  row: CardRow,
  index: CategoryIndex,
  ratings: ReadonlyMap<string, RatingRow>,
): ProductSummary {
  return { ...toHomeProduct(row, index), rating: toRating(ratings.get(row.id)) };
}

const optionsSchema = z.array(
  z.object({
    name: z.string().min(1),
    values: z.array(
      z.object({
        value: z.string().min(1),
        label: z.string().min(1),
        swatch_hex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullish(),
      }),
    ),
  }),
);

const specsSchema = z.array(z.object({ label: z.string().min(1), value: z.string().min(1) }));

/** JSONB is validated, not trusted: malformed data renders as "no options". */
export function parseOptions(json: Json): ProductOption[] {
  const parsed = optionsSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.map((option) => ({
    name: option.name,
    values: option.values.map(({ value, label, swatch_hex }) => ({
      value,
      label,
      ...(swatch_hex ? { swatchHex: swatch_hex } : {}),
    })),
  }));
}

export function parseSpecs(json: Json): ProductSpec[] {
  const parsed = specsSchema.safeParse(json);
  return parsed.success ? parsed.data : [];
}

function parseOptionValues(json: Json): Record<string, string> {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return {};
  return Object.fromEntries(
    Object.entries(json).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/**
 * Live try-on only: no photo try-on provider is configured (AGENTS §14.2), so
 * `photo_ai` assets never advertise a capability here.
 */
function toTryOn(row: DetailRow, previewImage: ProductTryOn["previewImage"]): ProductTryOn | null {
  const live = row.product_ar_assets.find(
    (asset) => asset.is_active && (asset.mode === "live_2d" || asset.mode === "live_3d"),
  );
  if (!live) return null;
  return { modes: ["live"], placement: live.placement, previewImage };
}

export function toProductDetail(
  row: DetailRow,
  index: CategoryIndex,
  rating: RatingRow | undefined,
  now: number,
): ProductDetail {
  const category = index.byId.get(row.category_id);
  const media = [...row.product_media].sort(bySortOrder);
  const cover = media[0];

  return {
    slug: row.slug,
    title: row.title,
    category: category ? { slug: category.slug, title: category.title } : { slug: "", title: "Shop" },
    badge: productBadge(row, now),
    rating: toRating(rating),
    shortDescription: row.short_description,
    description: row.description,
    basePricePaisa: row.base_price_paisa,
    lowStockThreshold: row.low_stock_threshold,
    options: parseOptions(row.options),
    variants: row.product_variants
      .filter((variant) => variant.is_active)
      .sort(bySortOrder)
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        optionValues: parseOptionValues(variant.option_values),
        pricePaisa: variant.price_paisa,
        stockQuantity: variant.stock_quantity,
      })),
    media: media.flatMap((item) => {
      const image = productMediaImage(item.storage_path, item.alt_text);
      return image ? [{ id: item.id, image, variantId: item.variant_id }] : [];
    }),
    specs: parseSpecs(row.specs),
    careInstructions: row.care_instructions,
    // The preview is decorative next to the card's own heading.
    tryOn: toTryOn(row, cover ? productMediaImage(cover.storage_path, "") : null),
  };
}

/* ---------- Homepage content ---------- */

/** Collections without a hero photo are skipped: the carousel is photo-led. */
export function toHomeCollection(row: CollectionRow): HomeCollection | null {
  const image = productMediaImage(row.hero_image_path, row.hero_image_alt);
  if (!image) return null;
  return {
    slug: row.slug,
    eyebrow: row.eyebrow,
    title: row.title,
    description: row.description,
    image,
  };
}

export function toTestimonial(row: TestimonialRow): Testimonial {
  return {
    id: row.review_id,
    quote: row.quote,
    authorName: row.author_name,
    authorLabel: "Verified Customer",
  };
}
