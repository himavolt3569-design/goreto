import type { StockStatus } from "@/components/ui/status";
import type { MediaImage } from "@/components/ui/media-frame";
import type { ProductDetail, ProductMedia, ProductVariant } from "./types";

/*
 * Variant selection for the product page (client-safe, no data). Prices and
 * stock here drive the display only; checkout re-reads both from the database.
 */

/** Per-line cap so one cart line can't request an unreasonable quantity. */
export const MAX_QUANTITY_PER_LINE = 10;

type VariantSource = Pick<ProductDetail, "variants">;

/** The variant whose option values match every entry in `selection`. */
export function findVariant(
  variants: ProductVariant[],
  selection: Record<string, string>,
): ProductVariant | undefined {
  const entries = Object.entries(selection);
  return variants.find((variant) =>
    entries.every(([name, value]) => variant.optionValues[name] === value),
  );
}

/** First variant in stock, else the first variant. */
export function defaultVariant(product: VariantSource): ProductVariant {
  const [first] = product.variants;
  if (!first) throw new Error("A product needs at least one variant.");
  return product.variants.find((variant) => variant.stockQuantity > 0) ?? first;
}

/**
 * The variant to switch to when the shopper picks `value` for `optionName`.
 * Keeps the other current choices when that combination exists, otherwise
 * falls back to any variant with the chosen value.
 */
export function selectOption(
  product: VariantSource,
  current: ProductVariant,
  optionName: string,
  value: string,
): ProductVariant {
  return (
    findVariant(product.variants, { ...current.optionValues, [optionName]: value }) ??
    product.variants.find((variant) => variant.optionValues[optionName] === value) ??
    current
  );
}

/** True when choosing `value` from the current selection lands on a sold-out variant. */
export function isOptionSoldOut(
  product: VariantSource,
  current: ProductVariant,
  optionName: string,
  value: string,
): boolean {
  return selectOption(product, current, optionName, value).stockQuantity <= 0;
}

export function variantPrice(
  product: Pick<ProductDetail, "basePricePaisa">,
  variant: ProductVariant,
): number {
  return variant.pricePaisa ?? product.basePricePaisa;
}

/** "Grey" or "Grey / M"; `null` for products without options. */
export function variantLabel(
  product: Pick<ProductDetail, "options">,
  variant: ProductVariant,
): string | null {
  const labels = product.options.flatMap((option) => {
    const value = variant.optionValues[option.name];
    const match = option.values.find((candidate) => candidate.value === value);
    return match ? [match.label] : [];
  });
  return labels.length > 0 ? labels.join(" / ") : null;
}

export type StockState = { status: StockStatus; label: string };

export function stockState(stockQuantity: number, lowStockThreshold: number): StockState {
  if (stockQuantity <= 0) return { status: "sold_out", label: "Sold Out" };
  if (stockQuantity <= lowStockThreshold) {
    return { status: "low_stock", label: `Only ${stockQuantity} left` };
  }
  return { status: "in_stock", label: "In Stock" };
}

/** Highest quantity the stepper allows for a variant (0 when sold out). */
export function maxPurchasable(stockQuantity: number): number {
  return Math.max(0, Math.min(stockQuantity, MAX_QUANTITY_PER_LINE));
}

/**
 * Gallery for a variant: its own photos first, then photos shared by every
 * variant. Photos of other variants are left out.
 */
export function mediaForVariant(media: ProductMedia[], variantId: string): ProductMedia[] {
  const own = media.filter((item) => item.variantId === variantId);
  const shared = media.filter((item) => item.variantId === null);
  return [...own, ...shared];
}

/** A photo of the variant(s) carrying `value`, for image swatches. */
export function swatchImage(
  product: Pick<ProductDetail, "variants" | "media">,
  optionName: string,
  value: string,
): MediaImage | null {
  const ids = new Set(
    product.variants
      .filter((variant) => variant.optionValues[optionName] === value)
      .map((variant) => variant.id),
  );
  const match = product.media.find((item) => item.variantId !== null && ids.has(item.variantId));
  return match?.image ?? null;
}
