import { z } from "zod";
import { SLUG_MAX_LENGTH, SLUG_MAX_WORDS, skuStem, slugFromTitle, suggestSku } from "./keys";
import { requiredText, rupees, text, wholeNumber, type ProductFormValues } from "./schema";

/*
 * Bulk add products (prompts/goreto-admin-bulk-add-products.md): the short
 * card staff fill in. The browser runs `quickProductSchema` for inline
 * errors; the server runs it again, then saves the card as an ordinary
 * product (no options, one variant) through the full editor's schema and
 * admin_save_product.
 */

/** Cards per batch, so one sitting stays reliable. */
export const MAX_QUICK_PRODUCTS = 20;

export const quickProductSchema = z
  .object({
    title: requiredText(120, "Enter a product name"),
    categoryId: z.uuid("Choose a category"),
    price: rupees(true),
    compareAtPrice: rupees(false),
    stock: wholeNumber(0, 100_000, "Enter stock between 0 and 100,000"),
    shortDescription: text(200, "the description"),
    publish: z.boolean(),
  })
  .superRefine((product, context) => {
    if (product.price !== null && product.compareAtPrice !== null && product.compareAtPrice <= product.price) {
      context.addIssue({ code: "custom", path: ["compareAtPrice"], message: "The was price must be higher than the price" });
    }
  });

export type QuickProductValues = z.input<typeof quickProductSchema>;

export function emptyQuickProduct(categoryId = ""): QuickProductValues {
  return { title: "", categoryId, price: "", compareAtPrice: "", stock: "1", shortDescription: "", publish: false };
}

/** `base`, then `base-2`, `base-3`, …: trimmed to whole words so it keeps the slug limits. */
export function numberedSlug(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = String(attempt);
  const words = base.split("-").filter(Boolean).slice(0, SLUG_MAX_WORDS - 1);
  while (words.length > 0 && `${words.join("-")}-${suffix}`.length > SLUG_MAX_LENGTH) words.pop();
  return words.length > 0 ? `${words.join("-")}-${suffix}` : `product-${suffix}`;
}

/** `GRT-<STEM>-STD`, then `GRT-<STEM>-STD-2`, … */
export function numberedSku(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`;
}

/** Slug and SKU a card starts from, before collisions are resolved. */
export function quickKeys(title: string): { slug: string; sku: string } {
  const slug = slugFromTitle(title);
  return { slug: slug.length >= 3 ? slug : `product-${slug || "new"}`.replace(/-$/, ""), sku: suggestSku(skuStem(title), [], {}) };
}

/** Alt text for the n-th photo or video (1-based), from the product name. */
export function defaultAltText(title: string, kind: "image" | "video", position: number): string {
  const name = title.trim();
  if (kind === "image") return position === 1 ? name : `${name}, photo ${position}`;
  return `${name}, video ${position}`;
}

/** A card as full-editor values: one variant with the card's stock, draft unless published. */
export function toProductFormValues(
  card: QuickProductValues,
  { slug, sku, lowStockThreshold }: { slug: string; sku: string; lowStockThreshold: number },
): ProductFormValues {
  return {
    title: card.title,
    slug,
    categoryId: card.categoryId,
    shortDescription: card.shortDescription,
    description: "",
    basePrice: card.price,
    compareAtPrice: card.compareAtPrice,
    status: card.publish ? "active" : "draft",
    isFeatured: false,
    isBestseller: false,
    isLimitedEdition: false,
    lowStockThreshold: String(lowStockThreshold),
    options: [],
    variants: [{ id: null, sku, title: "", optionValues: {}, price: "", weightGrams: "", isActive: true, initialStock: card.stock }],
    specs: [],
    careInstructions: "",
    tags: [],
    collectionIds: null,
  };
}
