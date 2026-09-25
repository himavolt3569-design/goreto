/*
 * Stable identifiers the product editor derives from what staff type: option
 * value keys (stored in variants' option_values), URL slugs and SKUs in the
 * seed's `GRT-<STEM>-<CODES>` shape.
 */

/** "Dusty Rose" -> "dusty-rose". Matches the database's slug check. */
export function toKey(text: string, maxLength = 60): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** A key for `label` that isn't in `taken` ("red", "red-2", ...). */
export function uniqueKey(label: string, taken: ReadonlySet<string>): string {
  const base = toKey(label) || "value";
  let candidate = base;
  for (let suffix = 2; taken.has(candidate); suffix += 1) candidate = `${base}-${suffix}`;
  return candidate;
}

/* ---------- URL slugs ---------- */

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 80;
export const SLUG_MAX_WORDS = 8;

/** Words in a slug ("pearl-drop-earrings" -> 3). */
export function slugWordCount(slug: string): number {
  return slug.split("-").filter(Boolean).length;
}

/** URL slug for a product name: the first 8 words, at most 80 characters, cut at a word boundary. */
export function slugFromTitle(title: string): string {
  const words = toKey(title, 500).split("-").filter(Boolean).slice(0, SLUG_MAX_WORDS);
  let slug = "";
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > SLUG_MAX_LENGTH) break;
    slug = next;
  }
  return slug || toKey(title, SLUG_MAX_LENGTH);
}

/**
 * While typing a custom slug: lowercase, spaces/underscores to dashes, other
 * symbols dropped. Leading and doubled dashes are tidied; a trailing dash is
 * kept so the next word can be typed.
 */
export function sanitizeSlugInput(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX_LENGTH);
}

/** Why a slug is invalid, or null. Uniqueness is checked by the database. */
export function slugProblem(slug: string): string | null {
  if (slug.length === 0) return "Enter a URL slug";
  if (!/^[a-z0-9-]+$/.test(slug)) return "Use lowercase letters, digits and dashes only";
  if (/^-|-$|--/.test(slug)) return "Dashes go between words, one at a time";
  if (slug.length < SLUG_MIN_LENGTH) return `Use at least ${SLUG_MIN_LENGTH} characters`;
  if (slug.length > SLUG_MAX_LENGTH) return `Use at most ${SLUG_MAX_LENGTH} characters`;
  if (slugWordCount(slug) > SLUG_MAX_WORDS) return `Use at most ${SLUG_MAX_WORDS} words`;
  return null;
}

const STOP_WORDS = new Set(["and", "with", "of", "the", "a", "an", "&"]);

/** "Pearl Drop Earrings" -> "PDE"; short titles are padded from the last word. */
export function skuStem(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()));
  if (words.length === 0) return "NEW";
  let stem = words.map((word) => word[0]!.toUpperCase()).join("").slice(0, 3);
  const last = words[words.length - 1]!;
  for (let index = 1; stem.length < 3; index += 1) stem += (last[index] ?? "X").toUpperCase();
  return stem;
}

/** Normalises typed SKUs to the stored shape: uppercase words joined by single dashes. */
export function normalizeSku(sku: string): string {
  return sku
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Suggested SKU for a variant: `GRT-<STEM>-<VALUE>-<VALUE>`, or
 * `GRT-<STEM>-STD` without options. Value codes come from the option keys.
 */
export function suggestSku(stem: string, optionNames: readonly string[], optionValues: Readonly<Record<string, string>>): string {
  const codes = optionNames.map((name) => normalizeSku(optionValues[name] ?? "")).filter(Boolean);
  return ["GRT", normalizeSku(stem) || "NEW", ...(codes.length > 0 ? codes : ["STD"])].join("-");
}
