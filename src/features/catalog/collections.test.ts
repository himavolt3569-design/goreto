import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCollectionBySlug, getCollectionProducts, getCollections } from "./collections";
import * as queries from "./queries";

vi.mock("./queries", () => import("@/test/fakes/catalog-queries"));
// unstable_cache needs the Next.js runtime; in tests it just calls through.
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
});

describe("collection reads", () => {
  it("lists live collections with product counts, keeping photo-less ones", async () => {
    const collections = await getCollections();
    expect(collections.map((collection) => [collection.slug, collection.productCount])).toEqual([
      ["autumn-styles", 3],
      ["no-photo", 0],
    ]);
    expect(collections[1]?.image).toBeNull();
  });

  it("finds a collection by slug", async () => {
    expect(await getCollectionBySlug("autumn-styles")).toMatchObject({
      title: "Autumn Styles",
      image: { alt: "Woven wrap" },
    });
    expect(await getCollectionBySlug("does-not-exist")).toBeNull();
  });

  it("rejects malformed slugs without querying", async () => {
    const spy = vi.spyOn(queries, "fetchCollectionBySlug");
    expect(await getCollectionBySlug("Autumn-Styles")).toBeNull();
    expect(await getCollectionBySlug("../autumn-styles")).toBeNull();
    expect(await getCollectionProducts("a".repeat(121), "featured")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps the curated order for Featured and sorts by price", async () => {
    const slugs = async (sort: "featured" | "price-asc" | "price-desc") =>
      (await getCollectionProducts("autumn-styles", sort)).map((product) => product.slug);
    expect(await slugs("featured")).toEqual(["canvas-tote", "pearl-drop-earrings", "silver-jhumka"]);
    expect(await slugs("price-asc")).toEqual(["canvas-tote", "silver-jhumka", "pearl-drop-earrings"]);
    expect(await slugs("price-desc")).toEqual(["pearl-drop-earrings", "silver-jhumka", "canvas-tote"]);
  });

  it("maps products with their top-level category and rating", async () => {
    const [tote, pearl] = await getCollectionProducts("autumn-styles", "featured");
    expect(tote).toMatchObject({ categorySlug: "bags", rating: null });
    expect(pearl).toMatchObject({ categorySlug: "jewelry", rating: { value: 4.8, count: 120 } });
  });

  it("returns no products for an empty collection", async () => {
    expect(await getCollectionProducts("no-photo", "featured")).toEqual([]);
  });
});
