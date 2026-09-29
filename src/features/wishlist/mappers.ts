import type { MediaImage } from "@/components/ui/media-frame";
import type { NewCartLine } from "@/features/cart/store";
import { parseOptions, parseOptionValues } from "@/features/catalog/mappers";
import type { ProductVariant } from "@/features/catalog/types";
import { maxPurchasable, stockState, variantLabel, variantPrice, type StockState } from "@/features/catalog/variants";
import { productMediaImage } from "@/lib/media/storage";
import type { Tables } from "@/types/database";

/*
 * Wishlist rows → view model (AGENTS §4.9). Prices and stock are the current
 * catalog values for display only; checkout re-prices on the server.
 */

export type WishlistRow = Pick<Tables<"wishlist_items">, "id" | "created_at"> & {
  product:
    | (Pick<Tables<"products">, "slug" | "title" | "status" | "base_price_paisa" | "low_stock_threshold" | "options"> & {
        product_variants: Pick<
          Tables<"product_variants">,
          "id" | "sku" | "option_values" | "price_paisa" | "stock_quantity" | "sort_order" | "is_active"
        >[];
        product_media: Pick<Tables<"product_media">, "storage_path" | "alt_text" | "sort_order" | "variant_id">[];
      })
    | null;
};

/** What the card's main action does. */
export type WishlistPurchase =
  | { kind: "add"; line: NewCartLine }
  | { kind: "options" }
  | { kind: "sold_out" };

export type WishlistProduct = {
  slug: string;
  title: string;
  image: MediaImage | null;
  /** Lowest current price across the purchasable variants. */
  pricePaisa: number;
  /** True when variants cost different amounts ("From Rs. …"). */
  priceVaries: boolean;
  stock: StockState;
  purchase: WishlistPurchase;
};

export type WishlistEntry = {
  itemId: string;
  savedAt: string;
  /** Null when the product is no longer on sale (draft, archived or hidden). */
  product: WishlistProduct | null;
};

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

export function toWishlistEntry(row: WishlistRow): WishlistEntry {
  return { itemId: row.id, savedAt: row.created_at, product: toWishlistProduct(row.product) };
}

function toWishlistProduct(row: WishlistRow["product"]): WishlistProduct | null {
  if (!row || row.status !== "active") return null;

  const variants: ProductVariant[] = row.product_variants
    .filter((variant) => variant.is_active)
    .sort(bySortOrder)
    .map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      optionValues: parseOptionValues(variant.option_values),
      pricePaisa: variant.price_paisa,
      stockQuantity: variant.stock_quantity,
    }));
  if (variants.length === 0) return null;

  const product = { basePricePaisa: row.base_price_paisa, options: parseOptions(row.options) };
  const prices = variants.map((variant) => variantPrice(product, variant));
  const pricePaisa = Math.min(...prices);
  const totalStock = variants.reduce((total, variant) => total + Math.max(0, variant.stockQuantity), 0);

  const media = [...row.product_media].sort(bySortOrder);
  const [only] = variants.length === 1 ? variants : [];
  const cover = (only && media.find((item) => item.variant_id === only.id)) ?? media.find((item) => item.variant_id === null) ?? media[0];
  const image = cover ? productMediaImage(cover.storage_path, cover.alt_text) : null;

  let purchase: WishlistPurchase;
  if (totalStock === 0) {
    purchase = { kind: "sold_out" };
  } else if (only) {
    purchase = {
      kind: "add",
      line: {
        variantId: only.id,
        productSlug: row.slug,
        title: row.title,
        variantLabel: variantLabel(product, only),
        sku: only.sku,
        image,
        unitPricePaisa: variantPrice(product, only),
        maxQuantity: maxPurchasable(only.stockQuantity),
      },
    };
  } else {
    purchase = { kind: "options" };
  }

  return {
    slug: row.slug,
    title: row.title,
    image,
    pricePaisa,
    priceVaries: prices.some((price) => price !== pricePaisa),
    stock: stockState(totalStock, row.low_stock_threshold),
    purchase,
  };
}
