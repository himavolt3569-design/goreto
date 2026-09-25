import { describe, expect, it } from "vitest";
import { paisaToRupeesInput, parseRupeesToPaisa } from "./parse";

describe("parseRupeesToPaisa", () => {
  it.each([
    ["2499", 249900],
    ["2,499.50", 249950],
    ["1,24,580", 12458000],
    ["0.05", 5],
    ["  Rs. 999.9 ", 99990],
    ["0", 0],
  ])("parses %s", (input, paisa) => {
    expect(parseRupeesToPaisa(input)).toEqual({ ok: true, paisa });
  });

  it.each(["", "-5", "12.345", "1e3", "abc", "12.", ".5", "20000000"])("rejects %j", (input) => {
    expect(parseRupeesToPaisa(input).ok).toBe(false);
  });

  it("never loses paisa to floating point", () => {
    // 0.1 + 0.2 style inputs stay exact.
    expect(parseRupeesToPaisa("1234567.89")).toEqual({ ok: true, paisa: 123456789 });
  });
});

describe("paisaToRupeesInput", () => {
  it("round-trips with the parser", () => {
    for (const paisa of [0, 5, 99990, 249900, 249950, 123456789]) {
      const parsed = parseRupeesToPaisa(paisaToRupeesInput(paisa));
      expect(parsed).toEqual({ ok: true, paisa });
    }
  });

  it("is empty for no price", () => {
    expect(paisaToRupeesInput(null)).toBe("");
  });
});
