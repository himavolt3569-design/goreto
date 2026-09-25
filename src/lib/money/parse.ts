/*
 * Rupee text from admin forms <-> integer paisa (AGENTS §15.1, §26.9). Parsed
 * as a string so no floating-point value ever becomes money.
 */

const MAX_RUPEES = 10_000_000; // Rs. 1 crore: far above any product price.

export type ParsedRupees = { ok: true; paisa: number } | { ok: false; message: string };

/** "2,499.50" -> 249950. Accepts lakh or thousand commas and up to 2 decimals. */
export function parseRupeesToPaisa(input: string): ParsedRupees {
  const text = input.trim().replace(/^rs\.?\s*/i, "").replace(/,/g, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return { ok: false, message: "Enter an amount in rupees, e.g. 2499 or 2499.50" };
  const rupees = Number(match[1]);
  if (rupees > MAX_RUPEES) return { ok: false, message: "That amount is too large" };
  const paisa = Number((match[2] ?? "").padEnd(2, "0"));
  return { ok: true, paisa: rupees * 100 + paisa };
}

/** 249950 -> "2499.50", 249900 -> "2499". For prefilling form inputs. */
export function paisaToRupeesInput(paisa: number | null | undefined): string {
  if (paisa === null || paisa === undefined) return "";
  if (!Number.isSafeInteger(paisa) || paisa < 0) throw new TypeError(`Expected non-negative integer paisa, received ${paisa}`);
  const rupees = Math.trunc(paisa / 100);
  const remainder = paisa % 100;
  return remainder === 0 ? String(rupees) : `${rupees}.${String(remainder).padStart(2, "0")}`;
}
