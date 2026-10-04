import "server-only";
import type { Database } from "@/types/database";
import { collectionState, type CollectionState } from "../states";
import { toKathmanduInput } from "../catalog-forms";
import { containsPattern, sanitizeSearch } from "../search-input";
import { adminDb, fail, mediaUrl } from "./shared";

/* Reads for the collection editor (RLS: collections for content.manage; products as the caller may see them). */

type ProductStatus = Database["public"]["Enums"]["product_status"];

export type PickerProduct = { id: string; title: string; status: ProductStatus; thumbnail: string | null };

/** Linked products the caller can't read (e.g. drafts without catalog.read) are kept by id so saving doesn't drop them. */
export type CollectionProduct = PickerProduct | { id: string; title: null; status: null; thumbnail: null };

export const PICKER_PRODUCT_COLUMNS = "id, title, status, product_media(storage_path, sort_order, kind)";

type PickerRow = { id: string; title: string; status: ProductStatus; product_media: { storage_path: string; sort_order: number; kind: "image" | "video" }[] };

export function mapPickerProduct(row: PickerRow): PickerProduct {
  const cover = row.product_media.filter((media) => media.kind === "image").sort((a, b) => a.sort_order - b.sort_order)[0];
  return { id: row.id, title: row.title, status: row.status, thumbnail: mediaUrl(cover?.storage_path) };
}

export type ProductSearchResult = { ok: true; products: PickerProduct[] } | { ok: false; message: string };

/**
 * Non-archived products whose name contains `query` (at most 20), for the
 * admin product pickers. The calling action checks permission first; RLS
 * decides which products the caller sees.
 */
export async function searchPickerProducts(query: unknown, what: string): Promise<ProductSearchResult> {
  const term = sanitizeSearch(query);
  if (term.length < 2) return { ok: true, products: [] };

  const { data, error } = await adminDb()
    .from("products")
    .select(PICKER_PRODUCT_COLUMNS)
    .ilike("title", containsPattern(term))
    .neq("status", "archived")
    .order("title")
    .order("sort_order", { referencedTable: "product_media" })
    .eq("product_media.kind", "image")
    .limit(1, { referencedTable: "product_media" })
    .limit(20);
  if (error) {
    console.error(`Admin action failed (${what}): ${error.code ?? "unknown"}`);
    return { ok: false, message: "Search didn't work. Please try again." };
  }
  return { ok: true, products: data.map(mapPickerProduct) };
}

export type CollectionFormValues = {
  title: string;
  slug: string;
  eyebrow: string;
  description: string;
  heroImagePath: string;
  heroImageAlt: string;
  isActive: boolean;
  sortOrder: number;
  startsAt: string;
  endsAt: string;
};

export type CollectionEditorData = {
  id: string;
  values: CollectionFormValues;
  heroImageUrl: string | null;
  products: CollectionProduct[];
  state: CollectionState;
  updatedAt: string;
};

export function emptyCollectionValues(): CollectionFormValues {
  return {
    title: "",
    slug: "",
    eyebrow: "",
    description: "",
    heroImagePath: "",
    heroImageAlt: "",
    isActive: true,
    sortOrder: 0,
    startsAt: "",
    endsAt: "",
  };
}

export async function fetchCollectionEditor(id: string): Promise<CollectionEditorData | null> {
  const { data, error } = await adminDb()
    .from("collections")
    .select(
      `id, title, slug, eyebrow, description, hero_image_path, hero_image_alt, sort_order, is_active, starts_at, ends_at, updated_at,
       collection_products(product_id, sort_order, products(${PICKER_PRODUCT_COLUMNS}))`,
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "collection_products" })
    .maybeSingle();
  if (error) fail("collection editor", error);
  if (!data) return null;

  return {
    id: data.id,
    values: {
      title: data.title,
      slug: data.slug,
      eyebrow: data.eyebrow,
      description: data.description,
      heroImagePath: data.hero_image_path ?? "",
      heroImageAlt: data.hero_image_alt,
      isActive: data.is_active,
      sortOrder: data.sort_order,
      startsAt: toKathmanduInput(data.starts_at),
      endsAt: toKathmanduInput(data.ends_at),
    },
    heroImageUrl: mediaUrl(data.hero_image_path),
    products: data.collection_products.map((link) =>
      link.products ? mapPickerProduct(link.products) : { id: link.product_id, title: null, status: null, thumbnail: null },
    ),
    state: collectionState({ isActive: data.is_active, startsAt: data.starts_at, endsAt: data.ends_at }, new Date()),
    updatedAt: data.updated_at,
  };
}
