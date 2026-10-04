import { beforeEach, describe, expect, it, vi } from "vitest";
import { toWishlistEntry, type WishlistRow } from "./mappers";

type ProductRow = NonNullable<WishlistRow["product"]>;
type VariantRow = ProductRow["product_variants"][number];

const variant = (overrides: Partial<VariantRow>): VariantRow => ({
  id: "v-1",
  sku: "TOTE-1",
  option_values: {},
  price_paisa: null,
  stock_quantity: 12,
  sort_order: 0,
  is_active: true,
  ...overrides,
});

const row = (product: Partial<ProductRow> | null): WishlistRow => ({
  id: "w-1",
  created_at: "2026-09-29T04:00:00Z",
  product:
    product === null
      ? null
      : {
          slug: "tote-bag",
          title: "Tote Bag",
          status: "active",
          base_price_paisa: 249_900,
          low_stock_threshold: 5,
          options: [],
          product_variants: [variant({})],
          product_media: [
            { storage_path: "products/tote/2.jpg", alt_text: "Back", sort_order: 1, variant_id: null },
            { storage_path: "products/tote/1.jpg", alt_text: "Front", sort_order: 0, variant_id: null },
          ],
          ...product,
        },
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
});

describe("toWishlistEntry", () => {
  it("offers Add to Cart for a single in-stock variant with the current price", () => {
    const entry = toWishlistEntry(row({}));
    expect(entry.itemId).toBe("w-1");
    const product = entry.product!;
    expect(product.pricePaisa).toBe(249_900);
    expect(product.priceVaries).toBe(false);
    expect(product.stock).toEqual({ status: "in_stock", label: "In Stock" });
    expect(product.image?.alt).toBe("Front");
    expect(product.purchase).toMatchObject({
      kind: "add",
      line: { variantId: "v-1", productSlug: "tote-bag", sku: "TOTE-1", unitPricePaisa: 249_900, maxQuantity: 10, variantLabel: null },
    });
  });

  it("sends products with choices to the product page and shows the lowest price", () => {
    const product = toWishlistEntry(
      row({
        product_variants: [
          variant({ id: "v-1", price_paisa: 300_000, stock_quantity: 0 }),
          variant({ id: "v-2", price_paisa: 280_000, stock_quantity: 2 }),
          variant({ id: "v-3", price_paisa: 100_000, is_active: false }),
        ],
      }),
    ).product!;
    expect(product.purchase).toEqual({ kind: "options" });
    expect(product.pricePaisa).toBe(280_000);
    expect(product.priceVaries).toBe(true);
    expect(product.stock).toEqual({ status: "low_stock", label: "Only 2 left" });
  });

  it("marks a product with no stock as sold out", () => {
    const product = toWishlistEntry(row({ product_variants: [variant({ stock_quantity: 0 })] })).product!;
    expect(product.purchase).toEqual({ kind: "sold_out" });
    expect(product.stock.status).toBe("sold_out");
  });

  it("treats hidden, archived and variant-less products as no longer available", () => {
    expect(toWishlistEntry(row(null)).product).toBeNull();
    expect(toWishlistEntry(row({ status: "archived" })).product).toBeNull();
    expect(toWishlistEntry(row({ product_variants: [variant({ is_active: false })] })).product).toBeNull();
  });
});
