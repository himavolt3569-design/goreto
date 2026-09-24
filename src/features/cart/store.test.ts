import { beforeEach, describe, expect, it } from "vitest";
import { addLine, countItems, rehydrateCart, useCartStore, type NewCartLine } from "./store";

const line: NewCartLine = {
  variantId: "knit-slouch-beanie--red",
  productSlug: "knit-slouch-beanie",
  title: "Knit Slouch Beanie",
  variantLabel: "Red",
  sku: "GRT-KSB-RED",
  image: null,
  unitPricePaisa: 99900,
  maxQuantity: 4,
};

describe("addLine", () => {
  it("adds a new line", () => {
    const result = addLine([], line, 2);
    expect(result.added).toBe(2);
    expect(result.lines).toEqual([{ ...line, quantity: 2 }]);
  });

  it("merges with an existing line and clamps to the line limit", () => {
    const first = addLine([], line, 3);
    const second = addLine(first.lines, line, 3);
    expect(second.added).toBe(1);
    expect(second.lines).toHaveLength(1);
    expect(second.lines[0].quantity).toBe(4);
  });

  it("adds nothing once the line is at its limit", () => {
    const full = addLine([], line, 4);
    const again = addLine(full.lines, line, 1);
    expect(again.added).toBe(0);
    expect(again.lines).toBe(full.lines);
  });

  it("ignores zero, negative and fractional quantities", () => {
    expect(addLine([], line, 0).added).toBe(0);
    expect(addLine([], line, -2).added).toBe(0);
    expect(addLine([], line, 1.9).added).toBe(1);
  });
});

describe("useCartStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  it("counts units across lines", () => {
    useCartStore.getState().addItem(line, 2);
    useCartStore.getState().addItem({ ...line, variantId: "other", sku: "OTHER" }, 1);
    expect(countItems(useCartStore.getState().lines)).toBe(3);
  });

  it("persists lines to localStorage and loads them back", async () => {
    useCartStore.getState().addItem(line, 2);
    const saved = JSON.parse(localStorage.getItem("goreto-cart") ?? "{}");
    expect(saved.state.lines[0].quantity).toBe(2);

    // Simulate a fresh page load: the in-memory cart is empty, storage has a saved line.
    localStorage.setItem(
      "goreto-cart",
      JSON.stringify({ state: { lines: [{ ...line, quantity: 3 }] }, version: 1 }),
    );
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState().lines).toEqual([{ ...line, quantity: 3 }]);
    expect(() => rehydrateCart()).not.toThrow();
  });

  it("removes a line", () => {
    useCartStore.getState().addItem(line, 1);
    useCartStore.getState().removeItem(line.variantId);
    expect(useCartStore.getState().lines).toEqual([]);
  });
});
