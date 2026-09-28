import { describe, expect, it } from "vitest";
import { toCardRow, type SearchRow } from "./mappers";

const row: SearchRow = {
  id: "p1",
  slug: "pearl-choker",
  title: "Pearl Choker",
  category_id: "c1",
  base_price_paisa: 249900,
  is_bestseller: false,
  is_limited_edition: true,
  published_at: "2026-09-01T00:00:00Z",
  cover_path: "products/pearl-choker/01.jpg",
  cover_alt: "Pearl choker on a stand",
  total_count: 1,
};

describe("toCardRow", () => {
  it("keeps the card fields and wraps the cover as the first photo", () => {
    expect(toCardRow(row)).toEqual({
      id: "p1",
      slug: "pearl-choker",
      title: "Pearl Choker",
      category_id: "c1",
      base_price_paisa: 249900,
      is_bestseller: false,
      is_limited_edition: true,
      published_at: "2026-09-01T00:00:00Z",
      product_media: [{ storage_path: "products/pearl-choker/01.jpg", alt_text: "Pearl choker on a stand" }],
    });
  });

  it("has no photo when the product has none", () => {
    const bare = { ...row, cover_path: null, cover_alt: null } as unknown as SearchRow;
    expect(toCardRow(bare).product_media).toEqual([]);
  });
});
