import { describe, expect, it } from "vitest";
import { picsumImage } from "./picsum";

describe("picsumImage", () => {
  it("builds a fixed-id Picsum URL", () => {
    expect(picsumImage(1027, 800, 900)).toBe("https://picsum.photos/id/1027/800/900");
  });

  it("rejects non-integer input", () => {
    expect(() => picsumImage(1.5, 100, 100)).toThrow(TypeError);
    expect(() => picsumImage(10, -1, 100)).toThrow(TypeError);
  });
});
