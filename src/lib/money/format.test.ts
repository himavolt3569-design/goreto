import { describe, expect, it } from "vitest";
import { formatNpr } from "./format";

describe("formatNpr", () => {
  it("formats whole rupees without paisa", () => {
    expect(formatNpr(249900)).toBe("Rs. 2,499");
    expect(formatNpr(0)).toBe("Rs. 0");
  });

  it("uses lakh grouping", () => {
    expect(formatNpr(12458000)).toBe("Rs. 1,24,580");
    expect(formatNpr(1000000000)).toBe("Rs. 1,00,00,000");
  });

  it("shows paisa when the amount is not a whole rupee", () => {
    expect(formatNpr(249950)).toBe("Rs. 2,499.50");
    expect(formatNpr(5)).toBe("Rs. 0.05");
  });

  it("formats negative amounts", () => {
    expect(formatNpr(-50000)).toBe("-Rs. 500");
  });

  it("rejects non-integer input", () => {
    expect(() => formatNpr(24.99)).toThrow(TypeError);
  });
});
