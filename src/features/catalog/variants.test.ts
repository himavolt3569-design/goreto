import { describe, expect, it } from "vitest";
import { seedProducts } from "@/test/fixtures/catalog";
import type { ProductDetail } from "./types";
import {
  defaultVariant,
  findVariant,
  isOptionSoldOut,
  maxPurchasable,
  MAX_QUANTITY_PER_LINE,
  mediaForVariant,
  selectOption,
  stockState,
  swatchImage,
  variantLabel,
  variantPrice,
} from "./variants";

function product(slug: string): ProductDetail {
  const found = seedProducts.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`missing seed product ${slug}`);
  return found;
}

/** A two-option product built in the test, since the seed has one option per product. */
const tee: ProductDetail = {
  ...product("white-lace-sundress"),
  options: [
    { name: "Color", values: [{ value: "white", label: "White" }, { value: "black", label: "Black" }] },
    { name: "Size", values: [{ value: "s", label: "S" }, { value: "m", label: "M" }] },
  ],
  variants: [
    { id: "w-s", sku: "W-S", optionValues: { Color: "white", Size: "s" }, pricePaisa: null, stockQuantity: 0 },
    { id: "w-m", sku: "W-M", optionValues: { Color: "white", Size: "m" }, pricePaisa: null, stockQuantity: 4 },
    { id: "b-m", sku: "B-M", optionValues: { Color: "black", Size: "m" }, pricePaisa: 199900, stockQuantity: 2 },
  ],
  media: [],
};

describe("variant selection", () => {
  it("finds the variant matching every selected option", () => {
    expect(findVariant(tee.variants, { Color: "white", Size: "m" })?.id).toBe("w-m");
    expect(findVariant(tee.variants, { Color: "black", Size: "s" })).toBeUndefined();
  });

  it("defaults to the first in-stock variant", () => {
    expect(defaultVariant(tee).id).toBe("w-m");
    expect(defaultVariant(product("beaded-wrist-stack")).sku).toBe("GRT-BWS-TAN");
  });

  it("keeps the other choices when the new combination exists", () => {
    const whiteM = tee.variants[1];
    expect(selectOption(tee, whiteM, "Color", "black").id).toBe("b-m");
    expect(selectOption(tee, whiteM, "Size", "s").id).toBe("w-s");
  });

  it("falls back to any variant with the chosen value", () => {
    const blackM = tee.variants[2];
    // Black / S doesn't exist, so picking S lands on White / S.
    expect(selectOption(tee, blackM, "Size", "s").id).toBe("w-s");
  });

  it("prefers an in-stock variant when falling back", () => {
    const shirt: ProductDetail = {
      ...tee,
      variants: [
        { id: "w-s", sku: "W-S", optionValues: { Color: "white", Size: "s" }, pricePaisa: null, stockQuantity: 0 },
        { id: "w-l", sku: "W-L", optionValues: { Color: "white", Size: "l" }, pricePaisa: null, stockQuantity: 3 },
        { id: "b-m", sku: "B-M", optionValues: { Color: "black", Size: "m" }, pricePaisa: null, stockQuantity: 2 },
      ],
    };
    // White / M doesn't exist; White / S is sold out, White / L is in stock.
    expect(selectOption(shirt, shirt.variants[2], "Color", "white").id).toBe("w-l");
    // With nothing in stock for the value, it still lands on a matching variant.
    expect(selectOption(tee, tee.variants[2], "Size", "s").id).toBe("w-s");
  });

  it("flags values that lead to a sold-out variant", () => {
    const whiteM = tee.variants[1];
    expect(isOptionSoldOut(tee, whiteM, "Size", "s")).toBe(true);
    expect(isOptionSoldOut(tee, whiteM, "Color", "black")).toBe(false);
  });

  it("uses the variant price override, else the base price", () => {
    expect(variantPrice(tee, tee.variants[2])).toBe(199900);
    expect(variantPrice(tee, tee.variants[1])).toBe(tee.basePricePaisa);
  });

  it("labels a variant by its option values", () => {
    expect(variantLabel(tee, tee.variants[2])).toBe("Black / M");
    const bag = product("leather-weekender-bag");
    expect(variantLabel(bag, bag.variants[0])).toBeNull();
  });
});

describe("stock", () => {
  it("maps stock to in stock / low stock / sold out", () => {
    expect(stockState(0, 5)).toEqual({ status: "sold_out", label: "Sold Out" });
    expect(stockState(3, 5)).toEqual({ status: "low_stock", label: "Only 3 left" });
    expect(stockState(6, 5)).toEqual({ status: "in_stock", label: "In Stock" });
  });

  it("caps the purchasable quantity per line", () => {
    expect(maxPurchasable(0)).toBe(0);
    expect(maxPurchasable(4)).toBe(4);
    expect(maxPurchasable(500)).toBe(MAX_QUANTITY_PER_LINE);
  });
});

describe("variant media", () => {
  const beanie = product("knit-slouch-beanie");
  const [grey, red] = beanie.variants;

  it("shows only the selected variant's own photos plus shared ones", () => {
    expect(mediaForVariant(beanie.media, red.id).map((item) => item.image.alt)).toEqual([
      "Red knit beanie worn in a forest",
    ]);
    expect(mediaForVariant(beanie.media, grey.id)).toHaveLength(1);
  });

  it("keeps shared photos for products without variant photos", () => {
    const bracelets = product("beaded-wrist-stack");
    expect(mediaForVariant(bracelets.media, bracelets.variants[1].id)).toHaveLength(2);
  });

  it("finds a swatch photo for values that have one", () => {
    expect(swatchImage(beanie, "Color", "red")?.alt).toBe("Red knit beanie worn in a forest");
    expect(swatchImage(product("beaded-wrist-stack"), "Color", "tan")).toBeNull();
  });
});
