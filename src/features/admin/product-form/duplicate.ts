import { SLUG_MAX_LENGTH, SLUG_MAX_WORDS } from "./keys";
import type { ProductFormValues } from "./schema";

/*
 * Duplicate product (prompts/goreto-admin-media-ar.md): the copy's name,
 * slug and SKUs. The copy is a draft with no stock, no merchandising flags
 * and new variants; the server saves it through the same checks as Create.
 */

const TITLE_MAX_LENGTH = 120;
const SKU_MAX_LENGTH = 64;
const TITLE_SUFFIX = " (copy)";

export function copyTitle(title: string): string {
  return `${title.slice(0, TITLE_MAX_LENGTH - TITLE_SUFFIX.length).trimEnd()}${TITLE_SUFFIX}`;
}

/** `<slug>-copy`, then `-copy-2`, … : trimmed to whole words so the result keeps the slug limits. */
export function copySlug(slug: string, taken: ReadonlySet<string>): string {
  for (let attempt = 1; ; attempt += 1) {
    const suffix = attempt === 1 ? "copy" : `copy-${attempt}`;
    const room = SLUG_MAX_WORDS - suffix.split("-").length;
    const words = slug.split("-").filter(Boolean).slice(0, room);
    while (words.length > 0 && `${words.join("-")}-${suffix}`.length > SLUG_MAX_LENGTH) words.pop();
    const candidate = words.length > 0 ? `${words.join("-")}-${suffix}` : `product-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** `<SKU>-COPY`, then `-COPY-2`, … within 64 characters, unused by `taken` (which it extends). */
export function copySku(sku: string, taken: Set<string>): string {
  for (let attempt = 1; ; attempt += 1) {
    const suffix = attempt === 1 ? "-COPY" : `-COPY-${attempt}`;
    const candidate = `${sku.slice(0, SKU_MAX_LENGTH - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

/**
 * Form values for the copy. `takenSlugs`/`takenSkus` are the values already in
 * use; collection links are copied only when the caller may edit them
 * (`collectionIds` null leaves a new product unlinked).
 */
export function duplicateValues(
  values: ProductFormValues,
  { takenSlugs, takenSkus, linkCollections }: { takenSlugs: ReadonlySet<string>; takenSkus: ReadonlySet<string>; linkCollections: boolean },
): ProductFormValues {
  const skus = new Set(takenSkus);
  for (const variant of values.variants) skus.add(variant.sku);
  return {
    ...values,
    title: copyTitle(values.title),
    slug: copySlug(values.slug, takenSlugs),
    status: "draft",
    isFeatured: false,
    isBestseller: false,
    // Sponsorship is a deal for one product; the copy starts without it.
    isSponsored: false,
    variants: values.variants.map((variant) => ({ ...variant, id: null, sku: copySku(variant.sku, skus), initialStock: "0" })),
    collectionIds: linkCollections ? values.collectionIds : null,
  };
}
