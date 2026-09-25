import { afterEach, describe, expect, it, vi } from "vitest";
import { productMediaImage, productMediaUrl } from "./storage";

describe("productMediaUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the public object URL for a key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co/");
    expect(productMediaUrl("products/pearl-drop-earrings/01.jpg")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/product-media/products/pearl-drop-earrings/01.jpg",
    );
  });

  it("encodes each path segment", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    expect(productMediaUrl("products/a b/ç.jpg")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/product-media/products/a%20b/%C3%A7.jpg",
    );
  });

  it("rejects URLs and traversal instead of keys", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    expect(() => productMediaUrl("https://evil.example/x.jpg")).toThrow(TypeError);
    expect(() => productMediaUrl("products/../secrets.jpg")).toThrow(TypeError);
    expect(() => productMediaUrl("")).toThrow(TypeError);
  });

  it("returns null images for missing keys", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    expect(productMediaImage(null, "x")).toBeNull();
    expect(productMediaImage("categories/bags.jpg", "")?.alt).toBe("");
  });
});
